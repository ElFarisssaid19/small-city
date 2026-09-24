import { Box3, Cache, MeshLambertMaterial, NearestFilter, Vector3 } from 'three';
import type { BufferGeometry, Material, Mesh, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** One geometry/material pair of a model; each becomes its own instanced mesh. */
export interface ModelPart {
  geometry: BufferGeometry;
  material: MeshLambertMaterial;
  /** The same surface washed out to grey, for abandoned buildings. */
  greyed: MeshLambertMaterial;
}

export interface LoadedModel {
  id: string;
  parts: ModelPart[];
  /** Bounding box size at kit scale (1 unit = 1 tile), after centring on the origin. */
  size: Vector3;
}

export interface ModelLibrary {
  get(id: string): LoadedModel | undefined;
  /** Ids that failed to load; their users fall back to simple shapes. */
  readonly failed: readonly string[];
}

/** Lambert shading with the kit's palette texture, like the rest of the scene. */
function toLambert(source: Material): MeshLambertMaterial {
  const map = (source as Material & { map?: Texture | null }).map ?? null;
  if (map) {
    // The kits use a small colour palette texture; nearest sampling keeps swatches crisp.
    map.magFilter = NearestFilter;
    map.minFilter = NearestFilter;
    map.generateMipmaps = false;
  }
  return new MeshLambertMaterial({ map, name: source.name });
}

/** A copy of `base` whose texture colour is desaturated and dimmed. */
function greyedVersion(base: MeshLambertMaterial): MeshLambertMaterial {
  const material = base.clone();
  material.name = `${base.name}-greyed`;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float grey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = vec3(grey * 0.62 + 0.05);`,
    );
  };
  material.customProgramCacheKey = () => 'greyed';
  return material;
}

/**
 * Loads every model once, bakes each mesh's transform into its geometry, keeps
 * only the attributes the renderer uses, and centres the model on the origin
 * with its base at y = 0. Materials are shared per kit and material name.
 */
export async function loadModelLibrary(
  ids: readonly string[],
  onProgress: (loaded: number, total: number) => void,
): Promise<ModelLibrary> {
  Cache.enabled = true; // the kits share one palette texture per folder
  const loader = new GLTFLoader();
  const base = `${import.meta.env.BASE_URL}models/`;
  const materials = new Map<
    string,
    { material: MeshLambertMaterial; greyed: MeshLambertMaterial }
  >();
  const models = new Map<string, LoadedModel>();
  const failed: string[] = [];
  let loaded = 0;
  onProgress(0, ids.length);

  const sharedMaterial = (kit: string, source: Material) => {
    const key = `${kit}/${source.name}`;
    let entry = materials.get(key);
    if (!entry) {
      const material = toLambert(source);
      entry = { material, greyed: greyedVersion(material) };
      materials.set(key, entry);
    }
    return entry;
  };

  await Promise.all(
    ids.map(async (id) => {
      try {
        const gltf = await loader.loadAsync(`${base}${id}.glb`);
        const kit = id.split('/')[0];
        const parts: ModelPart[] = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((object) => {
          const mesh = object as Mesh;
          if (!mesh.isMesh) return;
          const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
          const keep = new Set(['position', 'normal', 'uv']);
          for (const name of Object.keys(geometry.attributes)) {
            if (!keep.has(name)) geometry.deleteAttribute(name);
          }
          const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          parts.push({ geometry, ...sharedMaterial(kit, sources[0]) });
        });
        if (parts.length === 0) throw new Error(`${id} has no meshes`);

        const box = new Box3();
        for (const part of parts) {
          part.geometry.computeBoundingBox();
          if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
        }
        const centre = box.getCenter(new Vector3());
        for (const part of parts) part.geometry.translate(-centre.x, -box.min.y, -centre.z);
        models.set(id, { id, parts, size: box.getSize(new Vector3()) });
      } catch (error) {
        console.warn(`Could not load model ${id}`, error);
        failed.push(id);
      } finally {
        onProgress(++loaded, ids.length);
      }
    }),
  );

  return { get: (id) => models.get(id), failed };
}
