'use client';
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, extend, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
//import { SplatMesh } from "three/examples/jsm/objects/SplatMesh.js"; // se tiver 3DGS

extend({ OrbitControls });

function Controls() {
  const { camera, gl } = useThree();
  const controls = useRef();
  useFrame(() => controls.current?.update());
  return <orbitControls ref={controls} args={[camera, gl.domElement]} />;
}

export default function Editor3D({ file }) {
  const [model, setModel] = useState(null);
  const [rotation, setRotation] = useState([0, 0, 0]);
  const [scale, setScale] = useState([1, 1, 1]);
  const [position, setPosition] = useState([0, 0, 0]);
  const [lightIntensity, setLightIntensity] = useState(1);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "gltf" || ext === "glb") {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => setModel(gltf.scene),
        undefined,
        (err) => console.error("Erro ao carregar GLTF:", err)
      );
    } else if (ext === "ply") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const contents = event.target.result; // ArrayBuffer
        const loader = new PLYLoader();
        let geometry = null;

        try {
          // tenta parse como ASCII
          const text = new TextDecoder().decode(contents);
          geometry = loader.parse(text);
        } catch (asciiErr) {
          try {
            // se falhar, tenta parse binário
            geometry = loader.parse(contents);
          } catch (binaryErr) {
            console.error("Não foi possível carregar o PLY:", asciiErr, binaryErr);
            alert("Erro: ficheiro PLY inválido ou não suportado.");
            return;
          }
        }

        if (geometry) {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({ color: 0xdddddd });
          const mesh = new THREE.Mesh(geometry, material);
          setModel(mesh);
        }
      };

      // lê como ArrayBuffer (necessário para binário)
      reader.readAsArrayBuffer(file);
    } else {
      alert("Formato não suportado!");
    }

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div style={{ display: "flex" }}>
      <Canvas style={{ width: "800px", height: "600px", background: "#000" }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={lightIntensity} />
        <Controls />
        {model && (
          <primitive
            object={model}
            position={position}
            rotation={rotation}
            scale={scale}
          />
        )}
      </Canvas>

      <div style={{ marginLeft: "20px" }}>
        <h3>Transformações</h3>
        <div>
          <label>Posição X</label>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={position[0]}
            onChange={(e) =>
              setPosition([parseFloat(e.target.value), position[1], position[2]])
            }
          />
        </div>
        <div>
          <label>Posição Y</label>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={position[1]}
            onChange={(e) =>
              setPosition([position[0], parseFloat(e.target.value), position[2]])
            }
          />
        </div>
        <div>
          <label>Posição Z</label>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={position[2]}
            onChange={(e) =>
              setPosition([position[0], position[1], parseFloat(e.target.value)])
            }
          />
        </div>

        <h3>Rotação</h3>
        {["X", "Y", "Z"].map((axis, i) => (
          <div key={axis}>
            <label>{axis}</label>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={(rotation[i] * 180) / Math.PI}
              onChange={(e) => {
                const newRot = [...rotation];
                newRot[i] = (parseFloat(e.target.value) * Math.PI) / 180;
                setRotation(newRot);
              }}
            />
          </div>
        ))}

        <h3>Escala</h3>
        {["X", "Y", "Z"].map((axis, i) => (
          <div key={axis}>
            <label>{axis}</label>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={scale[i]}
              onChange={(e) => {
                const newScale = [...scale];
                newScale[i] = parseFloat(e.target.value);
                setScale(newScale);
              }}
            />
          </div>
        ))}

        <h3>Luz</h3>
        <input
          type="range"
          min={0}
          max={5}
          step={0.1}
          value={lightIntensity}
          onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
