export type Vec3 = [number, number, number];

export interface ChamberCfg {
  id: string;
  name: string;
  type: 'rect' | 'circular';
  size: Vec3;
  position: Vec3;
  texture: 'brick' | 'stone' | 'earth';
  vault: 'flat' | 'barrel' | 'dome';
  mural: boolean;
}

export interface FurnishingCfg {
  type:
    | 'coffin-bed'
    | 'pottery-row'
    | 'square-vats'
    | 'table'
    | 'wheel'
    | 'shelf'
    | 'chariot'
    | 'timber-house'
    | 'canopy'
    | 'bronze-set'
    | 'mill'
    | 'bath-set'
    | 'horse'
    | 'vessels'
    | 'figurines'
    | 'grave-goods';
  chamber: string;
  position: Vec3;
  rotation: number;
  count: number;
}

export interface CorridorCfg {
  from: string;
  to: string;
  length: number;
  width: number;
  height: number;
  rise: number; // 斜坡墓道落差（米）
  door: boolean; // 是否生成石门
}

export interface ArtifactCfg {
  id: string;
  chamber: string;
  position: Vec3;
  name: string;
  desc: string;
  url: string;
}

export interface SceneConfig {
  chambers: ChamberCfg[];
  corridors: CorridorCfg[];
  furnishings: FurnishingCfg[];
  artifacts: ArtifactCfg[];
}
