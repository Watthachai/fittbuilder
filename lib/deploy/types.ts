/** Code Runner's deploy side ↔ FITT Builder (migration 0059). */
export type DeliveryTarget = "local" | "cloud";
export type DeployEnv = "uat" | "production";
export type DeployStage = "waiting_image" | "registering" | "deploying" | "ready" | "failed";

export const DEPLOY_ENVS: readonly DeployEnv[] = ["uat", "production"];
export const DEPLOY_STAGES: readonly DeployStage[] = ["waiting_image", "registering", "deploying", "ready", "failed"];

export interface DeliveryRow {
  project_id: string;
  target: DeliveryTarget;
  admin_email: string;
  updated_at: string;
}

export interface DeployEventRow {
  project_id: string;
  env: DeployEnv;
  stage: DeployStage;
  build_no: number | null;
  digest: string | null;
  url: string | null;
  message: string;
  at: string;
}

/** The deploy side's credential reads every project, so it carries no workspace. */
export interface DeployBinding {
  id: string;
}

/** An email of the shape the 0059 check accepts. */
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
