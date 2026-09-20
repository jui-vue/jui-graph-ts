import { describe, expect, it } from "vitest";
import { Vector } from "./vector";

describe("Vector", () => {
  it("defaults x/y/z to 0 when omitted (falsy `||` default, per original)", () => {
    const v = new Vector();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });

  it("stores constructor args", () => {
    const v = new Vector(1, 2, 3);
    expect(v).toEqual({ x: 1, y: 2, z: 3 });
  });

  describe("add", () => {
    it("adds a number to all three components", () => {
      const v = new Vector(1, 2, 3).add(10);
      expect(v).toEqual({ x: 11, y: 12, z: 13 });
    });

    it("adds a Vector component-wise", () => {
      const v = new Vector(1, 2, 3).add(new Vector(10, 20, 30));
      expect(v).toEqual({ x: 11, y: 22, z: 33 });
    });

    it("returns a new Vector instance (immutable)", () => {
      const a = new Vector(1, 1, 1);
      const b = a.add(1);
      expect(b).not.toBe(a);
      expect(a).toEqual({ x: 1, y: 1, z: 1 });
    });
  });

  describe("subtract", () => {
    it("subtracts a number from all three components", () => {
      expect(new Vector(5, 5, 5).subtract(2)).toEqual({ x: 3, y: 3, z: 3 });
    });

    it("subtracts a Vector component-wise", () => {
      expect(new Vector(5, 5, 5).subtract(new Vector(1, 2, 3))).toEqual({ x: 4, y: 3, z: 2 });
    });
  });

  describe("multiply", () => {
    it("multiplies all three components by a number", () => {
      expect(new Vector(1, 2, 3).multiply(3)).toEqual({ x: 3, y: 6, z: 9 });
    });

    it("multiplies component-wise by a Vector", () => {
      expect(new Vector(1, 2, 3).multiply(new Vector(2, 2, 2))).toEqual({ x: 2, y: 4, z: 6 });
    });
  });

  describe("getMagnitude", () => {
    it("computes the euclidean norm", () => {
      expect(new Vector(3, 4, 0).getMagnitude()).toBe(5);
      expect(new Vector(0, 0, 0).getMagnitude()).toBe(0);
    });
  });

  describe("dotProduct (PRESERVED misnomer - returns the ANGLE between vectors, not the dot product)", () => {
    it("returns PI/2 for perpendicular unit vectors (Node-verified: acos(0) = PI/2)", () => {
      const angle = new Vector(1, 0, 0).dotProduct(new Vector(0, 1, 0));
      expect(angle).toBeCloseTo(Math.PI / 2, 10);
    });

    it("returns 0 for parallel same-direction vectors (acos(1) = 0)", () => {
      const angle = new Vector(2, 0, 0).dotProduct(new Vector(5, 0, 0));
      expect(angle).toBeCloseTo(0, 10);
    });

    it("returns PI for opposite-direction vectors (acos(-1) = PI)", () => {
      const angle = new Vector(1, 0, 0).dotProduct(new Vector(-1, 0, 0));
      expect(angle).toBeCloseTo(Math.PI, 10);
    });
  });

  describe("crossProduct", () => {
    it("computes the standard 3D cross product (x hat cross y hat = z hat)", () => {
      const v = new Vector(1, 0, 0).crossProduct(new Vector(0, 1, 0));
      expect(v).toEqual({ x: 0, y: 0, z: 1 });
    });

    it("is anti-commutative", () => {
      const a = new Vector(1, 2, 3);
      const b = new Vector(4, 5, 6);
      const ab = a.crossProduct(b);
      const ba = b.crossProduct(a);
      expect(ab).toEqual({ x: -ba.x, y: -ba.y, z: -ba.z });
    });
  });

  describe("normalize (PRESERVED: mutates in place, returns undefined/not chainable)", () => {
    it("scales the vector to unit length and returns undefined", () => {
      const v = new Vector(3, 4, 0);
      const result = v.normalize();
      expect(result).toBeUndefined();
      expect(v.x).toBeCloseTo(0.6, 10);
      expect(v.y).toBeCloseTo(0.8, 10);
      expect(v.z).toBe(0);
      expect(v.getMagnitude()).toBeCloseTo(1, 10);
    });

    it("produces NaN components for the zero vector (division by 0 magnitude, not guarded)", () => {
      const v = new Vector(0, 0, 0);
      v.normalize();
      expect(Number.isNaN(v.x)).toBe(true);
      expect(Number.isNaN(v.y)).toBe(true);
      expect(Number.isNaN(v.z)).toBe(true);
    });
  });
});
