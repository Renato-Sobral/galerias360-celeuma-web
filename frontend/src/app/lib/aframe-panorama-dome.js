"use client";

// Registers an A-Frame component that renders the panorama on an FBX dome model.
// Expected usage:
// <a-entity panorama-dome="src: /uploads/foo.jpg; kind: image; radius: 700; rotationY: -90; model: /models/Dome.fbx"></a-entity>
//
// Notes:
// - This relies on A-Frame injecting THREE onto window.
// - The FBX file must be reachable by the browser (e.g. placed in `frontend/public/models/Dome.fbx`).

export async function ensurePanoramaDomeComponent() {
    if (typeof window === "undefined") return;

    const AFRAME = window.AFRAME;
    const THREE = window.THREE;
    if (!AFRAME || !THREE) return;

    if (AFRAME.components["panorama-dome"]) return;

    const [{ FBXLoader }, { RGBELoader }, { EXRLoader }] = await Promise.all([
        import("three/examples/jsm/loaders/FBXLoader.js"),
        import("three/examples/jsm/loaders/RGBELoader.js"),
        import("three/examples/jsm/loaders/EXRLoader.js"),
    ]);

    const stripQuery = (value) => String(value || "").split("?")[0];

    const isExrUrl = (value) => /\.exr$/i.test(stripQuery(value));
    const isHdrUrl = (value) => /\.hdr$/i.test(stripQuery(value));

    const getVideoElement = (src) => {
        if (!src) return null;
        const raw = String(src);
        if (raw.startsWith("#")) return document.querySelector(raw);
        return document.querySelector(`video[src="${CSS.escape(raw)}"]`);
    };

    const disposeTexture = (texture) => {
        if (!texture) return;
        try {
            texture.dispose?.();
        } catch {
            // ignore
        }
    };

    const disposeObject3DDeep = (root) => {
        if (!root) return;

        root.traverse?.((child) => {
            if (!child) return;

            if (child.isMesh) {
                if (child.geometry) {
                    try {
                        child.geometry.dispose?.();
                    } catch {
                        // ignore
                    }
                }

                const material = child.material;
                if (Array.isArray(material)) {
                    material.forEach((mat) => {
                        if (mat?.map) disposeTexture(mat.map);
                        try {
                            mat?.dispose?.();
                        } catch {
                            // ignore
                        }
                    });
                } else if (material) {
                    if (material.map) disposeTexture(material.map);
                    try {
                        material.dispose?.();
                    } catch {
                        // ignore
                    }
                }
            }
        });
    };

    const computeHorizontalScaleForRadius = (object3D, radius) => {
        const safeRadius = Number.isFinite(Number(radius)) ? Number(radius) : 700;

        const box = new THREE.Box3().setFromObject(object3D);
        const size = new THREE.Vector3();
        box.getSize(size);

        const maxHorizontalDim = Math.max(size.x, size.z);
        const baseRadius = maxHorizontalDim > 0.0001 ? maxHorizontalDim / 2 : 1;

        return safeRadius / baseRadius;
    };

    const applyTextureWrapping = (texture) => {
        if (!texture) return;
        // Repeat horizontally to avoid seam clamp artifacts at u=0/1.
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
    };

    const makeEquirectShaderMaterial = (texture, opacity) => {
        const safeOpacity = Number.isFinite(Number(opacity)) ? Number(opacity) : 1;
        const transparent = safeOpacity < 1;

        return new THREE.ShaderMaterial({
            uniforms: {
                map: { value: texture },
                opacity: { value: safeOpacity },
            },
            vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
            fragmentShader: `
        precision highp float;
        uniform sampler2D map;
        uniform float opacity;
        varying vec3 vWorldDir;

        const float PI = 3.1415926535897932384626433832795;

        void main() {
          vec3 dir = normalize(vWorldDir);
          // Equirectangular projection.
          float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
                    float v = 0.5 - asin(clamp(dir.y, -1.0, 1.0)) / PI;
                    // Some dome FBX meshes end up with inverted vertical direction; flip V so sky is up.
                    v = 1.0 - v;
          vec4 color = texture2D(map, vec2(u, v));
          gl_FragColor = vec4(color.rgb, color.a * opacity);
        }
      `,
            side: THREE.DoubleSide,
            transparent,
            depthWrite: !transparent,
        });
    };

    const disposeMaterial = (material) => {
        if (!material) return;
        if (Array.isArray(material)) {
            material.forEach((mat) => {
                try {
                    mat?.dispose?.();
                } catch {
                    // ignore
                }
            });
            return;
        }

        try {
            material.dispose?.();
        } catch {
            // ignore
        }
    };

    const makeShadowReceiverMaterial = (opacity = 0.68) => {
        const safeOpacity = Number.isFinite(Number(opacity)) ? Number(opacity) : 0.68;
        return new THREE.ShadowMaterial({
            side: THREE.DoubleSide,
            opacity: Math.min(1, Math.max(0, safeOpacity)),
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        });
    };

    AFRAME.registerComponent("panorama-dome", {
        schema: {
            model: { type: "string", default: "/models/Dome.fbx" },
            src: { type: "string", default: "" },
            kind: { type: "string", default: "image" }, // image | video | hdr
            projection: { type: "string", default: "spherical" }, // spherical | uv
            alignY: { type: "string", default: "floor" }, // floor | center
            recenter: { type: "boolean", default: true },
            radius: { type: "number", default: 700 },
            rotationY: { type: "number", default: -90 },
            opacity: { type: "number", default: 1 },
            shadowOpacity: { type: "number", default: 0.68 },
        },

        init() {
            this._isDisposed = false;
            this._fbxLoader = new FBXLoader();
            this._textureLoader = new THREE.TextureLoader();
            this._rgbeLoader = new RGBELoader();
            this._exrLoader = new EXRLoader();
            this._shadowReceivers = [];

            // Match A-Frame's common asset loading behavior.
            try {
                this._textureLoader.setCrossOrigin?.("anonymous");
                this._rgbeLoader.setCrossOrigin?.("anonymous");
                this._exrLoader.setCrossOrigin?.("anonymous");
                this._fbxLoader.setCrossOrigin?.("anonymous");
            } catch {
                // ignore
            }

            this._modelObject = null;
            this._currentTexture = null;
            this._currentVideoTexture = null;
            this._lastApplied = { model: "", src: "", kind: "", radius: 0, rotationY: 0, opacity: 1, shadowOpacity: 0.68 };

            // A-Frame might cull large meshes aggressively; keep it safe.
            this.el.object3D.frustumCulled = false;
        },

        async update(oldData) {
            if (this._isDisposed) return;

            const data = this.data;
            const needsModelReload = !this._modelObject || data.model !== this._lastApplied.model;

            try {
                if (needsModelReload) {
                    await this._loadModel(data.model);
                }

                // Always re-apply transforms if the radius/rotation changed.
                if (this._modelObject) {
                    const scaleXZ = computeHorizontalScaleForRadius(this._modelObject, data.radius);
                    // Keep vertical scale stable; radius should only affect width/depth.
                    const fixedY = Number.isFinite(this._modelObject.scale.y) ? this._modelObject.scale.y : 1;
                    this._modelObject.scale.set(scaleXZ, fixedY, scaleXZ);
                    this._modelObject.rotation.y = THREE.MathUtils.degToRad(Number(data.rotationY) || 0);
                }

                const needsTextureReload =
                    data.src !== this._lastApplied.src ||
                    data.kind !== this._lastApplied.kind ||
                    data.opacity !== this._lastApplied.opacity ||
                    data.shadowOpacity !== this._lastApplied.shadowOpacity ||
                    needsModelReload;

                if (needsTextureReload && this._modelObject) {
                    const texture = await this._loadTexture(data.kind, data.src);
                    await this._applyTexture(texture, data.opacity, data.shadowOpacity);
                }

                this._lastApplied = {
                    model: data.model,
                    src: data.src,
                    kind: data.kind,
                    radius: data.radius,
                    rotationY: data.rotationY,
                    opacity: data.opacity,
                    shadowOpacity: data.shadowOpacity,
                };

                this.el.emit("panorama-dome-loaded", { ok: true }, false);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Falha ao carregar o dome 360.";
                this.el.emit("panorama-dome-error", { message }, false);
            }
        },

        remove() {
            this._isDisposed = true;

            this._clearShadowReceivers();

            if (this._modelObject && this._modelObject.parent) {
                this._modelObject.parent.remove(this._modelObject);
            }

            disposeObject3DDeep(this._modelObject);
            this._modelObject = null;

            disposeTexture(this._currentTexture);
            this._currentTexture = null;

            disposeTexture(this._currentVideoTexture);
            this._currentVideoTexture = null;
        },

        _clearShadowReceivers() {
            if (!Array.isArray(this._shadowReceivers) || this._shadowReceivers.length === 0) return;

            this._shadowReceivers.forEach((receiver) => {
                if (!receiver) return;
                if (receiver.parent) {
                    receiver.parent.remove(receiver);
                }
                disposeMaterial(receiver.material);
            });

            this._shadowReceivers = [];
        },

        async _loadModel(modelUrl) {
            if (this._modelObject && this._modelObject.parent) {
                this._modelObject.parent.remove(this._modelObject);
            }
            disposeObject3DDeep(this._modelObject);
            this._modelObject = null;

            const safeUrl = String(modelUrl || "");
            if (!safeUrl) throw new Error("Caminho do modelo FBX não definido.");

            const object = await new Promise((resolve, reject) => {
                this._fbxLoader.load(
                    safeUrl,
                    (loaded) => resolve(loaded),
                    undefined,
                    () => reject(new Error("Não foi possível carregar o modelo FBX do dome."))
                );
            });

            if (this._isDisposed) {
                disposeObject3DDeep(object);
                return;
            }

            if (this.data?.recenter !== false) {
                // Recenter the model around the camera.
                // Default behavior keeps Y "floor-like" for hemisphere meshes (minY≈0).
                // If alignY is "center", we also recenter vertically.
                try {
                    const box = new THREE.Box3().setFromObject(object);
                    const center = new THREE.Vector3();
                    const size = new THREE.Vector3();
                    box.getCenter(center);
                    box.getSize(size);

                    // Always recenter horizontally.
                    object.position.x -= center.x;
                    object.position.z -= center.z;

                    const alignY = String(this.data?.alignY || "floor").toLowerCase();

                    if (alignY === "center") {
                        object.position.y -= center.y;
                    } else {
                        // If the model already sits on/above y=0, keep y as-is.
                        // Otherwise (e.g. full sphere), recenter vertically too.
                        const height = Math.max(1e-6, size.y);
                        const minY = box.min.y;
                        const isDomeLike = minY >= -0.01 * height;
                        if (!isDomeLike) {
                            object.position.y -= center.y;
                        }
                    }
                } catch {
                    // ignore
                }
            }

            object.traverse((child) => {
                if (!child?.isMesh) return;
                child.frustumCulled = false;
            });

            this.el.object3D.add(object);
            this._modelObject = object;
        },

        async _loadTexture(kind, src) {
            const safeKind = String(kind || "image").toLowerCase();
            const safeSrc = String(src || "");

            disposeTexture(this._currentTexture);
            this._currentTexture = null;

            disposeTexture(this._currentVideoTexture);
            this._currentVideoTexture = null;

            if (!safeSrc) throw new Error("Fonte do panorama não definida.");

            if (safeKind === "video") {
                const video = getVideoElement(safeSrc);
                if (!video) throw new Error("Vídeo do panorama não encontrado.");

                const videoTexture = new THREE.VideoTexture(video);
                videoTexture.colorSpace = THREE.SRGBColorSpace;
                videoTexture.minFilter = THREE.LinearFilter;
                videoTexture.magFilter = THREE.LinearFilter;
                videoTexture.generateMipmaps = false;
                videoTexture.needsUpdate = true;

                applyTextureWrapping(videoTexture);

                this._currentVideoTexture = videoTexture;
                return videoTexture;
            }

            if (safeKind === "hdr" || isHdrUrl(safeSrc) || isExrUrl(safeSrc)) {
                const isExr = isExrUrl(safeSrc);
                const loader = isExr ? this._exrLoader : this._rgbeLoader;

                const texture = await new Promise((resolve, reject) => {
                    loader.load(
                        safeSrc,
                        (loaded) => resolve(loaded),
                        undefined,
                        () => reject(new Error("Não foi possível carregar o ficheiro HDR/EXR."))
                    );
                });

                // Keep defaults; UVs drive sampling on the mesh.
                texture.needsUpdate = true;
                applyTextureWrapping(texture);
                this._currentTexture = texture;
                return texture;
            }

            // image
            const texture = await new Promise((resolve, reject) => {
                this._textureLoader.load(
                    safeSrc,
                    (loaded) => resolve(loaded),
                    undefined,
                    () => reject(new Error("Não foi possível carregar a imagem do panorama."))
                );
            });

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            applyTextureWrapping(texture);
            this._currentTexture = texture;
            return texture;
        },

        async _applyTexture(texture, opacity, shadowOpacity) {
            if (!this._modelObject) return;
            if (!texture) return;

            const safeOpacity = 1;
            const transparent = false;
            const projection = String(this.data?.projection || "spherical").toLowerCase();

            this._clearShadowReceivers();

            const buildMaterial = () => {
                if (projection === "uv") {
                    return new THREE.MeshBasicMaterial({
                        map: texture,
                        side: THREE.DoubleSide,
                        transparent,
                        opacity: safeOpacity,
                        depthWrite: !transparent,
                    });
                }

                // Default: spherical projection, ignores FBX UV unwrap.
                return makeEquirectShaderMaterial(texture, safeOpacity);
            };

            const domeMeshes = [];
            this._modelObject.traverse((child) => {
                if (!child?.isMesh) return;
                domeMeshes.push(child);
            });

            domeMeshes.forEach((child) => {
                if (!child?.isMesh) return;

                disposeMaterial(child.material);
                child.material = buildMaterial();
                child.castShadow = false;
                child.receiveShadow = false;
                child.renderOrder = -100; // Put dome rendering before other objects to occlude what's outside

                // Dedicated shadow receiver mesh so shadows are visible even with unlit/shader panorama materials.
                const shadowReceiver = new THREE.Mesh(child.geometry, makeShadowReceiverMaterial());
                shadowReceiver.material.opacity = Math.min(1, Math.max(0, Number(shadowOpacity) || 0.68));
                shadowReceiver.frustumCulled = false;
                shadowReceiver.castShadow = false;
                shadowReceiver.receiveShadow = true;
                shadowReceiver.renderOrder = -99;
                child.add(shadowReceiver);
                this._shadowReceivers.push(shadowReceiver);
            });
        },
    });
}
