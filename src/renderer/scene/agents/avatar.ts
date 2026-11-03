import { CapsuleGeometry, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from 'three';

const bodyGeometry = new SphereGeometry(0.42, 24, 18);
const bellyGeometry = new SphereGeometry(0.28, 16, 12);
const eyeGeometry = new SphereGeometry(0.075, 12, 10);
const pupilGeometry = new SphereGeometry(0.038, 10, 8);
const footGeometry = new SphereGeometry(0.13, 12, 10);
const armGeometry = new CapsuleGeometry(0.055, 0.17, 4, 8);
const antennaGeometry = new CylinderGeometry(0.018, 0.024, 0.28, 8);
const tipGeometry = new SphereGeometry(0.07, 12, 10);
const eyeMaterial = new MeshStandardMaterial({ color: 0xfcfcff, roughness: 0.3 });
const pupilMaterial = new MeshBasicMaterial({ color: 0x1b1d2e });

export class Avatar {
  readonly root = new Group();
  private rig = new Group();
  private body: Mesh;
  private leftFoot: Mesh;
  private rightFoot: Mesh;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private tip: Mesh;
  private tipMaterial: MeshBasicMaterial;
  private material: MeshStandardMaterial;
  private accent: MeshStandardMaterial;
  private phase: number;

  walking = 0;
  typing = false;
  chatting = false;

  constructor(color: string, phase: number) {
    this.phase = phase;
    this.material = new MeshStandardMaterial({ color, roughness: 0.55 });
    this.accent = new MeshStandardMaterial({ color: new Color(color).offsetHSL(0, -0.05, 0.16), roughness: 0.6 });
    const dark = new MeshStandardMaterial({ color: new Color(color).offsetHSL(0, 0, -0.16), roughness: 0.7 });

    this.body = new Mesh(bodyGeometry, this.material);
    this.body.position.y = 0.52;
    this.body.scale.set(1, 1.04, 0.94);
    this.body.castShadow = true;

    const belly = new Mesh(bellyGeometry, this.accent);
    belly.position.set(0, -0.06, 0.2);
    belly.scale.set(1, 1, 0.7);
    this.body.add(belly);

    for (const side of [-1, 1]) {
      const eye = new Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(side * 0.15, 0.1, 0.35);
      const pupil = new Mesh(pupilGeometry, pupilMaterial);
      pupil.position.set(0, 0, 0.055);
      eye.add(pupil);
      this.body.add(eye);
    }

    const antenna = new Mesh(antennaGeometry, dark);
    antenna.position.y = 0.52;
    antenna.rotation.z = 0.12;
    this.body.add(antenna);
    this.tipMaterial = new MeshBasicMaterial({ color: new Color(color).offsetHSL(0, 0.1, 0.2) });
    this.tip = new Mesh(tipGeometry, this.tipMaterial);
    this.tip.position.set(-0.02, 0.68, 0);
    this.body.add(this.tip);

    this.leftFoot = new Mesh(footGeometry, dark);
    this.rightFoot = new Mesh(footGeometry, dark);
    this.leftFoot.scale.set(1, 0.6, 1.3);
    this.rightFoot.scale.set(1, 0.6, 1.3);
    this.leftFoot.position.set(-0.17, 0.08, 0.04);
    this.rightFoot.position.set(0.17, 0.08, 0.04);

    this.leftArm = new Mesh(armGeometry, this.material);
    this.rightArm = new Mesh(armGeometry, this.material);
    this.leftArm.position.set(-0.4, 0.48, 0.05);
    this.rightArm.position.set(0.4, 0.48, 0.05);
    this.leftArm.castShadow = this.rightArm.castShadow = true;

    this.rig.add(this.body, this.leftFoot, this.rightFoot, this.leftArm, this.rightArm);
    this.rig.scale.setScalar(1.08);
    this.root.add(this.rig);
  }

  update(time: number, motion: boolean): void {
    const t = time + this.phase;
    const stride = motion ? Math.sin(t * 9) : 0;
    const walk = this.walking;

    let bounce = Math.abs(stride) * 0.07 * walk;
    let squash = 1;
    if (motion && walk < 0.1) {
      squash = 1 + Math.sin(t * 2.1) * 0.012;
    }
    if (motion && this.chatting) bounce += Math.abs(Math.sin(t * 5)) * 0.05;
    this.rig.position.y = bounce;
    this.body.scale.y = 1.04 * squash;
    this.body.rotation.z = stride * 0.05 * walk;

    this.leftFoot.position.z = 0.04 + stride * 0.15 * walk;
    this.rightFoot.position.z = 0.04 - stride * 0.15 * walk;
    this.leftFoot.position.y = 0.08 + Math.max(0, stride) * 0.06 * walk;
    this.rightFoot.position.y = 0.08 + Math.max(0, -stride) * 0.06 * walk;

    if (this.typing) {
      this.leftArm.rotation.x = -1.3 + (motion ? Math.sin(t * 22) * 0.16 : 0);
      this.rightArm.rotation.x = -1.3 + (motion ? Math.sin(t * 19 + 1.2) * 0.16 : 0);
      this.leftArm.position.set(-0.3, 0.48, 0.28);
      this.rightArm.position.set(0.3, 0.48, 0.28);
    } else {
      const swing = stride * 0.5 * walk;
      const wave = motion && this.chatting ? Math.sin(t * 7) * 0.5 - 0.7 : 0;
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = -swing + wave;
      this.leftArm.position.set(-0.4, 0.48, 0.05);
      this.rightArm.position.set(0.4, 0.48, 0.05);
    }
    this.tip.position.x = -0.02 + (motion ? Math.sin(t * 3) * 0.02 : 0);
  }

  setColor(color: string): void {
    this.material.color.set(color);
    this.accent.color.set(color).offsetHSL(0, -0.05, 0.16);
    this.tipMaterial.color.set(color).offsetHSL(0, 0.1, 0.2);
  }

  dispose(): void {
    this.material.dispose();
    this.accent.dispose();
    this.tipMaterial.dispose();
  }
}
