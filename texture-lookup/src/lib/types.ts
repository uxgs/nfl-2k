export type TextureId = string;

export type PartKey =
  | "jerseyTop"
  | "sleeves"
  | "pants"
  | "socks"
  | "helmet"
  | "numbers"
  | "sidelineJerseys"
  | "teamSelectPlayer"
  | "teamSelectHelmet";

export type UniformBucketKey = "shared" | "home" | "away";

export type PartsMap = Partial<Record<PartKey, TextureId[]>>;

export type UniformEntry = Partial<Record<UniformBucketKey, PartsMap>>;

export type TeamEntry = {
  uniforms: Record<string, UniformEntry>;
};

export type GameEntry = {
  teams: Record<string, TeamEntry>;
};

export type TextureData = {
  games: Record<string, GameEntry>;
};

export type Usage = {
  game: string;
  team: string;
  uniformName: string;
  bucket: UniformBucketKey;
  part: PartKey;
};

export type SharingIndex = Record<TextureId, Usage[]>;

export type SetChoice = "home" | "away" | "both";

export type LookupSection = {
  title: string;
  bucket: UniformBucketKey;
  parts: PartsMap;
};

export type LookupResult = {
  sections: LookupSection[];
  sharedTextureIds: TextureId[];
  sharingIndex: SharingIndex;
};

