/** Design: Notte in Osteria — fondale Babylon discreto, con panno e luce da lampada calda. */
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

export type GameHandle = { scene: Scene; dispose: () => void };

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new FreeCamera("table-camera", new Vector3(0, 0, -10), scene);
  camera.setTarget(Vector3.Zero());
  const light = new HemisphericLight("warm-table-light", new Vector3(-1, 1, -1), scene);
  light.intensity = 0.6;
  const felt = MeshBuilder.CreatePlane("felt-reflection", { width: 13, height: 8 }, scene);
  const material = new StandardMaterial("felt-material", scene);
  material.diffuseColor = Color3.FromHexString("#0F4B3A");
  material.alpha = 0.07;
  material.emissiveColor = Color3.FromHexString("#0A2C24");
  felt.material = material;
  return { scene, dispose: () => scene.dispose() };
}

