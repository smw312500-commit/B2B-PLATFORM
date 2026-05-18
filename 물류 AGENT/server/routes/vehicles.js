import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

router.get("/", async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT id, plate_number AS plateNumber, vehicle_type AS vehicleType,
           capacity_kg AS capacityKg, status,
           driver_name AS driverName, driver_phone AS driverPhone,
           base_region AS baseRegion, created_at AS createdAt
    FROM vehicles ORDER BY id`);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { plateNumber, vehicleType, capacityKg, driverName, driverPhone, baseRegion } = req.body;
  const [result] = await pool.execute(
    "INSERT INTO vehicles (plate_number, vehicle_type, capacity_kg, status, driver_name, driver_phone, base_region, created_at) VALUES (?,?,?,'AVAILABLE',?,?,?,?)",
    [plateNumber, vehicleType, capacityKg, driverName, driverPhone ?? null, baseRegion ?? null, now()]
  );
  res.status(201).json({ id: result.insertId });
});

router.patch("/:id/status", async (req, res) => {
  await pool.execute("UPDATE vehicles SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  await pool.execute("DELETE FROM vehicles WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

export default router;
