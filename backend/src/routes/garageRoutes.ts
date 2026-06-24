import { Router } from "express";
import { createCustomer, listCustomers, createJob, listJobs, getJob, updateJob, createAppointment, listAppointments, updateAppointment } from "../controllers/garageController.ts";

// The whole router is gated by requireOrg("garage") at the mount (index.ts), which
// sets req.org. Every handler scopes its queries by req.org.id.
const router = Router();

router.post("/customers", createCustomer);
router.get("/customers", listCustomers);

router.post("/jobs", createJob);
router.get("/jobs", listJobs);
router.get("/jobs/:id", getJob);
router.patch("/jobs/:id", updateJob);

router.post("/appointments", createAppointment);
router.get("/appointments", listAppointments);
router.patch("/appointments/:id", updateAppointment);

export default router;
