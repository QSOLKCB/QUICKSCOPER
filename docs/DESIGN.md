# QUICKSCOPER v0.1.0 implementation notes

The opening brief asks for the feel of fast scope-and-shoot gameplay in a small, offline, single-player game using native browser technologies. The initial sketch had no executable HTML file and contained invalid shader assignment, incomplete camera matrices, mismatched buffer sizes, and unbounded timing. The implementation replaces those stubs with a coherent game while preserving the brief verbatim.

The simulation uses 120 Hz ticks. Rendering is independent, elapsed frame backlog is limited to 100 ms, and a large gap never becomes one giant movement step. Paused states consume no game time. Gameplay randomness comes from a per-run seed; visual effects and sound noise do not change gameplay RNG state. Bot movement is a bounded strafe around spawn anchors, not a navigation/pathfinding system. Bots visibly charge for 1.15 seconds before an attack, require line of sight, and are less likely to hit moving or sprinting players.

The renderer batches static, flat-shaded box geometry into one GPU buffer and streams small dynamic meshes for bots, rifle parts, and effects. Perspective and view matrices are column-major. The same world box dimensions drive rendering, movement collision, and ray occlusion. Bot rays are transformed into the model's local orientation before testing hitboxes. Limb geometry is deliberately forgiving; the central torso/head regions drive single-shot eliminations.

The viewmodel uses a separate depth pass. Canvas 2D draws the circular scope mask, fine reticle, timing arc, hitmarker, damage vignette, and transient score labels. The DOM provides menus and status. Reduced motion removes camera bob and muzzle flashes, reduces fragments, and replaces damage vignette flashes with a border. Render resolution is capped for high-DPI screens.

WebGL 2 is preferred, with WebGL 1 fallback using the same basic shaders. There is no WebGPU path: a second renderer would add complexity without helping this small scene. Everything ships as readable ES modules. Web Audio is initialized only after a user gesture and uses synthesized noise and oscillators. The sound graph has a single master volume and disposable voices.

Offline installation is atomic: all runtime files must cache successfully before the new worker becomes active. Each cache includes the registration scope, so other QSOL games on the same Pages origin are unaffected. Existing games finish on their current cache; updates wait for old tabs to close. Relative paths support both a root-mounted local server and the GitHub repository path.

The cloud preview environment may not expose WebGL. CI therefore checks rendered pixels and graphics errors in Chromium using software rendering, alongside input/lifecycle/offline checks. Real GPU performance and subjective mouse feel still benefit from human playtesting.

Next tuning should be based on play: scope timing, hip spread, bot placement, encounter density, and scoring. Keep the scope-to-shot rhythm central; avoid engine/framework migration or unnecessary service integrations.
