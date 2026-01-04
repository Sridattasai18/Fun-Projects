# 3D Hand-Controlled Particle Swarm: Implementation Details

A deep dive into how the computer vision and 3D physics work together in this app.

## 🌟 Technical Features

### 1. 3D Particle Engine
- **Technology**: Three.js (WebGL).
- **System**: 5,000 individual particles managed via BufferGeometry for performance.
- **Rendering**: Additive blending creates the "glow" effect without expensive post-processing.
- **Morphing**: Seamless interpolation between shape templates (Sphere, Galaxy, DNA, etc.).

### 2. Gesture Control System (The "Brain")

The application maps landmark data from MediaPipe to 3D forces:

#### ✋ Position & Rotation
- **Tracking**: The palm's center (Landmark 9) is mapped from 2D webcam space to 3D world space.
- **Tilt Control**: Wrist-to-palm vector orientation determines the rotation matrix applied to the particle system.

#### 👌 Scale & Zoom
- **Single Hand Pinch**: Calculated as the Euclidean distance between Thumb Tip (4) and Index Tip (8).
- **Dynamic Scaling**: The scale is smoothed using linear interpolation (lerping) to prevent camera jitter.

#### ✊ Tension Physics
- **Logic**: Average distance of all five fingertips to the wrist.
- **Force Mode**: When Tension > 0.2, the system switches from "Shape Mode" to "Attraction Mode," where particles are pulled into a dense cluster following the hand.

## 📁 Project Layout
```
/
├── index.html         # Main App (HTML/CSS/JS)
├── README.md          # GitHub Intro
└── IMPLEMENTATION.md  # Technical Specs
```
