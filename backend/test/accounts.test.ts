import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryRepo } from "../src/repo.js";

const makeApp = () => createApp(new MemoryRepo(), { origins: ["http://localhost:5173"], secret: "unit-test-secret-with-enough-entropy" });

describe("accounts", () => {
  it("registers, signs in, and identifies a persistent account", async () => {
    const app = makeApp();
    const reg = await request(app).post("/api/auth/register").send({ displayName: "Player One", avatar: "a1", email: "TEST@example.com", password: "very-long-test-password-123" });
    expect(reg.status).toBe(201); expect(reg.body.token).toBeTruthy(); expect(reg.body.email).toBe("test@example.com");
    const login = await request(app).post("/api/auth/login").send({ email: "test@example.com", password: "very-long-test-password-123" });
    expect(login.status).toBe(200); expect(login.body.token).toBeTruthy();
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(200); expect(me.body.account).toBe(true); expect(me.body.email).toBe("test@example.com");
  });
  it("rejects duplicate emails and incorrect passwords", async () => {
    const app = makeApp();
    const body = { displayName: "Player One", avatar: "a1", email: "test@example.com", password: "very-long-test-password-123" };
    expect((await request(app).post("/api/auth/register").send(body)).status).toBe(201);
    expect((await request(app).post("/api/auth/register").send(body)).status).toBe(409);
    expect((await request(app).post("/api/auth/login").send({ email: body.email, password: "wrong-password-123" })).status).toBe(401);
  });
  it("upgrades an existing guest without changing its player id", async () => {
    const app = makeApp();
    const g = await request(app).post("/api/guest").send({ displayName: "Guest One", avatar: "a1" });
    const upgraded = await request(app).post("/api/auth/upgrade").set("Authorization", `Bearer ${g.body.token}`).send({ email: "guest@example.com", password: "another-long-password-123" });
    expect(upgraded.status).toBe(201); expect(upgraded.body.player.id).toBe(g.body.player.id);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${g.body.token}`)).body.account).toBe(true);
  });
});
