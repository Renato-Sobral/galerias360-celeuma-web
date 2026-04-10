"use client";

// Registers an A-Frame component that renders the panorama on a sphere mesh.
// Expected usage:
// <a-entity panorama-dome="src: /uploads/foo.jpg; kind: image; radius: 700; rotationY: -90"></a-entity>
//
// Notes:
// - This relies on A-Frame injecting THREE onto window.

export async function ensurePanoramaDomeComponent() {
    if (typeof window === "undefined") return;

    const AFRAME = window.AFRAME;
    const THREE = window.THREE;
    if (!AFRAME || !THREE) return;

    if (AFRAME.components["panorama-dome"]) return;

    const [{ RGBELoader }, { EXRLoader }] = await Promise.all([
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
            if (!child.isMesh) return;

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
        });
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
                #include <common>
                #include <logdepthbuf_pars_vertex>
        varying vec3 vWorldDir;
        void main() {
                    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    vec3 worldCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                    vWorldDir = normalize(worldPos - worldCenter);
                    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
                    #include <logdepthbuf_vertex>
        }
      `,
            fragmentShader: `
                #include <common>
                #include <logdepthbuf_pars_fragment>
        precision highp float;
        uniform sampler2D map;
        uniform float opacity;
        varying vec3 vWorldDir;

        void main() {
          vec3 dir = normalize(vWorldDir);
          // Equirectangular projection.
          float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
                    float v = 0.5 - asin(clamp(dir.y, -1.0, 1.0)) / PI;
                    // Flip V so the sky is up.
                    v = 1.0 - v;
          vec4 color = texture2D(map, vec2(u, v));
          gl_FragColor = vec4(color.rgb, color.a * opacity);
                    #include <logdepthbuf_fragment>
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
            src: { type: "string", default: "" },
            kind: { type: "string", default: "image" }, // image | video | hdr
            projection: { type: "string", default: "spherical" }, // spherical | uv
            radius: { type: "number", default: 700 },
            rotationY: { type: "number", default: -90 },
            opacity: { type: "number", default: 1 },
        },

        init() {
            this._isDisposed = false;
            this._textureLoader = new THREE.TextureLoader();
            this._rgbeLoader = new RGBELoader();
            this._exrLoader = new EXRLoader();

            // Match A-Frame's common asset loading behavior.
            try {
                this._textureLoader.setCrossOrigin?.("anonymous");
                this._rgbeLoader.setCrossOrigin?.("anonymous");
                this._exrLoader.setCrossOrigin?.("anonymous");
            } catch {
                // ignore
            }

            this._sphereMesh = null;
            this._currentTexture = null;
            this._currentVideoTexture = null;
            this._lastApplied = { src: "", kind: "", radius: 0, rotationY: 0, opacity: 1 };

            // A-Frame might cull large meshes aggressively; keep it safe.
            this.el.object3D.frustumCulled = false;
        },

        async update(oldData) {
            if (this._isDisposed) return;

            const data = this.data;
            const needsModelReload = !this._sphereMesh;

            try {
                if (needsModelReload) {
                    await this._loadModel();
                }

                // Always re-apply transforms if the radius/rotation changed.
                if (this._sphereMesh) {
                    const safeRadius = Number.isFinite(Number(data.radius)) ? Number(data.radius) : 700;
                    this._sphereMesh.scale.set(safeRadius, safeRadius, safeRadius);
                    this._sphereMesh.rotation.y = THREE.MathUtils.degToRad(Number(data.rotationY) || 0);
                }

                const needsTextureReload =
                    data.src !== this._lastApplied.src ||
                    data.kind !== this._lastApplied.kind ||
                    data.opacity !== this._lastApplied.opacity ||
                    needsModelReload;

                if (needsTextureReload && this._sphereMesh) {
                    const texture = await this._loadTexture(data.kind, data.src);
                    await this._applyTexture(texture, data.opacity);
                }

                this._lastApplied = {
                    src: data.src,
                    kind: data.kind,
                    radius: data.radius,
                    rotationY: data.rotationY,
                    opacity: data.opacity,
                };

                this.el.emit("panorama-dome-loaded", { ok: true }, false);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Falha ao carregar o panorama 360.";
                this.el.emit("panorama-dome-error", { message }, false);
            }
        },

        remove() {
            this._isDisposed = true;

            if (this._sphereMesh && this._sphereMesh.parent) {
                this._sphereMesh.parent.remove(this._sphereMesh);
            }
            if (this._sphereMesh?.geometry) {
                try {
                    this._sphereMesh.geometry.dispose?.();
                } catch {
                    // ignore
                }
            }
            disposeMaterial(this._sphereMesh?.material);
            this._sphereMesh = null;

            disposeTexture(this._currentTexture);
            this._currentTexture = null;

            disposeTexture(this._currentVideoTexture);
            this._currentVideoTexture = null;
        },

        async _loadModel() {
            if (this._sphereMesh && this._sphereMesh.parent) {
                this._sphereMesh.parent.remove(this._sphereMesh);
            }
            if (this._sphereMesh?.geometry) {
                try {
                    this._sphereMesh.geometry.dispose?.();
                } catch {
                    // ignore
                }
            }
            disposeMaterial(this._sphereMesh?.material);
            this._sphereMesh = null;

            const geometry = new THREE.SphereGeometry(1, 64, 40);
            const material = new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                transparent: false,
                opacity: 1,
                depthWrite: true,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            this.el.object3D.add(mesh);
            this._sphereMesh = mesh;
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

        async _applyTexture(texture, opacity) {
            if (!this._sphereMesh) return;
            if (!texture) return;

            const safeOpacity = 1;
            const transparent = false;
            const projection = String(this.data?.projection || "spherical").toLowerCase();

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


            disposeMaterial(this._sphereMesh.material);
            this._sphereMesh.material = buildMaterial();
            this._sphereMesh.castShadow = false;
            this._sphereMesh.receiveShadow = false;
            this._sphereMesh.renderOrder = -100;
        },
    });
}
