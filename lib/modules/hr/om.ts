import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * Organisational structure — who reports to whom, and which seats exist.
 *
 * It owns `position` and `orgUnit` but reads `employee`, because a seat and the
 * person sitting in it are different facts with different lifetimes: the seat
 * outlives whoever holds it, and a vacancy is a seat with nobody in it rather than
 * a missing row.
 */
export const OM: Module = {
  id: "om",
  name: "โครงสร้างองค์กร",
  sapCode: "OM",
  family: "hr",
  tier: "base",
  pitch:
    "เห็นทั้งองค์กรว่าใครอยู่ตรงไหน ตำแหน่งไหนว่าง และคนที่นั่งอยู่มีคุณสมบัติครบหรือยัง — ไม่ต้องรอ HR วาดผังใหม่ทุกครั้งที่มีคนเข้าออก",
  keyFeatures: [
    "โครงสร้างองค์กร",
    "ตำแหน่งและหน้าที่งาน",
    "การมอบหมายผู้ดำรงตำแหน่ง",
    "การวางแผนอัตรากำลัง",
    "คุณสมบัติประจำตำแหน่ง",
    "รายงานและการวิเคราะห์",
  ],
  provides: ["orgUnit", "position"],
  needs: ["employee"],
  effortDays: 10,
  maPerMonth: 4000,
  build:
    "หน้าโครงสร้างองค์กร หกแท็บ — โครงสร้างองค์กร (หน่วยงานพร้อมสายบังคับบัญชาและจำนวนคน) · ตำแหน่งและหน้าที่งาน (ตารางตำแหน่ง ระดับ รายงานต่อใคร) · การมอบหมายผู้ดำรงตำแหน่ง (จับคนเข้าตำแหน่ง เปลี่ยนผู้ดำรงได้จริง ตำแหน่งที่ไม่มีคนขึ้นป้ายว่าง) · การวางแผนอัตรากำลัง (เทียบคนที่มีกับแผน แสดงว่าต้องรับเพิ่มกี่คน) · คุณสมบัติประจำตำแหน่ง (ทักษะที่ตำแหน่งต้องการเทียบกับที่ผู้ดำรงมี ขาดข้อไหนขีดฆ่าให้เห็น) · รายงานและการวิเคราะห์ (จำนวนคน อัตราตามแผน ตำแหน่งว่าง ช่วงการบังคับบัญชา และสัดส่วนคนต่อหน่วยงาน) · รายชื่อผู้ดำรงตำแหน่งอ่านจากทะเบียนพนักงาน",
  files: filesFor("om", ["screen.tsx", "data.ts"]),
};
