import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationError, extractBearerToken, localIdentity } from "../src/identity.js";

test("extractBearerToken acepta Bearer estricto", () => {
  assert.equal(extractBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(extractBearerToken("bearer token123"), "token123");
});

test("extractBearerToken rechaza cabeceras no Bearer", () => {
  assert.throws(() => extractBearerToken(undefined), AuthenticationError);
  assert.throws(() => extractBearerToken("Basic abc"), AuthenticationError);
  assert.throws(() => extractBearerToken("Bearer a b"), AuthenticationError);
});

test("localIdentity produce un owner opaco y estable", () => {
  const previous = process.env.PLAN_VIEWER_LOCAL_USER;
  process.env.PLAN_VIEWER_LOCAL_USER = "tester";
  try {
    const first = localIdentity();
    const second = localIdentity();
    assert.equal(first.ownerId, second.ownerId);
    assert.match(first.ownerId, /^local:/);
    assert.equal(first.ownerId.includes("tester"), false);
  } finally {
    if (previous === undefined) delete process.env.PLAN_VIEWER_LOCAL_USER;
    else process.env.PLAN_VIEWER_LOCAL_USER = previous;
  }
});
