import { describe, it, expect } from "vitest";
import { Transform } from "./transform";

describe("Transform class", () => {
    describe("2D transformations", () => {
        it("should apply 2D move transformation", () => {
            const points = [[0, 0, 1]];
            const transform = new Transform(points);
            const result = transform.move(5, 10);
            // [0, 0, 1] + [5, 10] = [5, 10, 1]
            expect(result[0][0]).toBeCloseTo(5);
            expect(result[0][1]).toBeCloseTo(10);
            expect(result[0][2]).toBeCloseTo(1);
        });

        it("should apply 2D scale transformation", () => {
            const points = [[2, 3, 1]];
            const transform = new Transform(points);
            const result = transform.scale(2, 3);
            // [2, 3, 1] * [2, 3] = [4, 9, 1]
            expect(result[0][0]).toBeCloseTo(4);
            expect(result[0][1]).toBeCloseTo(9);
            expect(result[0][2]).toBeCloseTo(1);
        });

        it("should apply 2D rotate transformation", () => {
            const points = [[1, 0, 1]];
            const transform = new Transform(points);
            const result = transform.rotate(90); // rotate 90 degrees
            // cos(90°) ≈ 0, sin(90°) ≈ 1
            // [1, 0, 1] rotated 90° = [0, 1, 1]
            expect(result[0][0]).toBeCloseTo(0, 5);
            expect(result[0][1]).toBeCloseTo(1, 5);
            expect(result[0][2]).toBeCloseTo(1);
        });

        it("should apply 2D rotate transformation (45 degrees)", () => {
            const points = [[1, 0, 1]];
            const transform = new Transform(points);
            const result = transform.rotate(45); // rotate 45 degrees
            // cos(45°) ≈ 0.707, sin(45°) ≈ 0.707
            const expectedX = Math.cos(Math.PI / 4); // ≈ 0.707
            const expectedY = Math.sin(Math.PI / 4); // ≈ 0.707
            expect(result[0][0]).toBeCloseTo(expectedX, 5);
            expect(result[0][1]).toBeCloseTo(expectedY, 5);
        });
    });

    describe("3D transformations", () => {
        it("should apply 3D move transformation", () => {
            const points = [[0, 0, 0, 1]];
            const transform = new Transform(points);
            const result = transform.move3d(5, 10, 15);
            // [0, 0, 0, 1] + [5, 10, 15] = [5, 10, 15, 1]
            expect(result[0][0]).toBeCloseTo(5);
            expect(result[0][1]).toBeCloseTo(10);
            expect(result[0][2]).toBeCloseTo(15);
            expect(result[0][3]).toBeCloseTo(1);
        });

        it("should apply 3D scale transformation", () => {
            const points = [[2, 3, 4, 1]];
            const transform = new Transform(points);
            const result = transform.scale3d(2, 3, 4);
            // [2, 3, 4, 1] * [2, 3, 4] = [4, 9, 16, 1]
            expect(result[0][0]).toBeCloseTo(4);
            expect(result[0][1]).toBeCloseTo(9);
            expect(result[0][2]).toBeCloseTo(16);
            expect(result[0][3]).toBeCloseTo(1);
        });

        it("should apply 3D rotation around Z axis (ROLL)", () => {
            const points = [[1, 0, 0, 1]];
            const transform = new Transform(points);
            const result = transform.rotate3dz(90); // rotate 90 degrees around Z
            // cos(90°) ≈ 0, sin(90°) ≈ 1
            // [1, 0, 0, 1] rotated 90° around Z = [0, 1, 0, 1]
            expect(result[0][0]).toBeCloseTo(0, 5);
            expect(result[0][1]).toBeCloseTo(1, 5);
            expect(result[0][2]).toBeCloseTo(0, 5);
            expect(result[0][3]).toBeCloseTo(1);
        });

        it("should apply 3D rotation around X axis (PITCH)", () => {
            const points = [[0, 1, 0, 1]];
            const transform = new Transform(points);
            const result = transform.rotate3dx(90); // rotate 90 degrees around X
            // cos(90°) ≈ 0, sin(90°) ≈ 1
            // [0, 1, 0, 1] rotated 90° around X = [0, 0, 1, 1]
            expect(result[0][0]).toBeCloseTo(0, 5);
            expect(result[0][1]).toBeCloseTo(0, 5);
            expect(result[0][2]).toBeCloseTo(1, 5);
            expect(result[0][3]).toBeCloseTo(1);
        });

        it("should apply 3D rotation around Y axis (YAW)", () => {
            const points = [[1, 0, 0, 1]];
            const transform = new Transform(points);
            const result = transform.rotate3dy(90); // rotate 90 degrees around Y
            // cos(90°) ≈ 0, sin(90°) ≈ 1
            // [1, 0, 0, 1] rotated 90° around Y = [0, 0, -1, 1]
            expect(result[0][0]).toBeCloseTo(0, 5);
            expect(result[0][1]).toBeCloseTo(0, 5);
            expect(result[0][2]).toBeCloseTo(-1, 5);
            expect(result[0][3]).toBeCloseTo(1);
        });
    });

    describe("matrix operations", () => {
        it("should create move matrix", () => {
            const transform = new Transform([]);
            const matrix = transform.matrix("move", 5, 10);
            // Should be identity matrix with translation
            expect(matrix[0][0]).toBe(1);
            expect(matrix[0][1]).toBe(0);
            expect(matrix[0][2]).toBe(5);
            expect(matrix[1][0]).toBe(0);
            expect(matrix[1][1]).toBe(1);
            expect(matrix[1][2]).toBe(10);
            expect(matrix[2][0]).toBe(0);
            expect(matrix[2][1]).toBe(0);
            expect(matrix[2][2]).toBe(1);
        });

        it("should create scale matrix", () => {
            const transform = new Transform([]);
            const matrix = transform.matrix("scale", 2, 3);
            // Should be scale matrix
            expect(matrix[0][0]).toBe(2);
            expect(matrix[0][1]).toBe(0);
            expect(matrix[1][0]).toBe(0);
            expect(matrix[1][1]).toBe(3);
            expect(matrix[2][2]).toBe(1);
        });

        it("should create rotate matrix", () => {
            const transform = new Transform([]);
            const matrix = transform.matrix("rotate", 0);
            // 0 degree rotation should be identity
            expect(matrix[0][0]).toBeCloseTo(1);
            expect(matrix[0][1]).toBeCloseTo(0);
            expect(matrix[1][0]).toBeCloseTo(0);
            expect(matrix[1][1]).toBeCloseTo(1);
        });
    });

    describe("custom and merge operations", () => {
        it("should apply custom matrix", () => {
            const points = [[2, 3, 1]];
            const transform = new Transform(points);
            const customMatrix = [
                [2, 0, 0],
                [0, 2, 0],
                [0, 0, 1],
            ];
            const result = transform.custom(customMatrix);
            // [2, 3, 1] * 2 = [4, 6, 1]
            expect(result[0][0]).toBeCloseTo(4);
            expect(result[0][1]).toBeCloseTo(6);
        });

        it("should merge multiple transformations", () => {
            const points = [[1, 1, 1]];
            const transform = new Transform(points);
            // Merge scale and move transformations
            // Matrix multiplication (scale × move) applied to [1, 1, 1]
            // Results in [1, 1, 1] moved by (5, 10) then scaled by 2 = [12, 22, 1]
            const result = transform.merge(["scale", 2, 2], ["move", 5, 10]);
            expect(result[0][0]).toBeCloseTo(12, 5);
            expect(result[0][1]).toBeCloseTo(22, 5);
        });

        it("should apply merge2 with callback", () => {
            const points = [[1, 1, 1], [2, 2, 1]];
            const transform = new Transform(points);

            transform.merge2(() => {
                // For each point, return scale transformation
                return [["scale", 2, 2]];
            });

            const result = transform.points;
            // First point: [1, 1, 1] * 2 = [2, 2, 1]
            expect(result[0][0]).toBeCloseTo(2, 5);
            expect(result[0][1]).toBeCloseTo(2, 5);
            // Second point: [2, 2, 1] * 2 = [4, 4, 1]
            expect(result[1][0]).toBeCloseTo(4, 5);
            expect(result[1][1]).toBeCloseTo(4, 5);
        });
    });

    describe("multiple points", () => {
        it("should transform multiple points", () => {
            const points = [[1, 1, 1], [2, 2, 1], [3, 3, 1]];
            const transform = new Transform(points);
            const result = transform.move(10, 20);

            expect(result[0][0]).toBeCloseTo(11);
            expect(result[0][1]).toBeCloseTo(21);

            expect(result[1][0]).toBeCloseTo(12);
            expect(result[1][1]).toBeCloseTo(22);

            expect(result[2][0]).toBeCloseTo(13);
            expect(result[2][1]).toBeCloseTo(23);
        });

        it("should chain transformations", () => {
            const points = [[1, 1, 1]];
            const transform = new Transform(points);
            transform.scale(2, 2);
            const final = transform.move(5, 5);
            // [1, 1, 1] scaled by 2 = [2, 2, 1], then moved by 5, 5 = [7, 7, 1]
            expect(final[0][0]).toBeCloseTo(7, 5);
            expect(final[0][1]).toBeCloseTo(7, 5);
        });
    });

    describe("edge cases", () => {
        it("should handle zero translations", () => {
            const points = [[5, 10, 1]];
            const transform = new Transform(points);
            const result = transform.move(0, 0);
            expect(result[0][0]).toBeCloseTo(5);
            expect(result[0][1]).toBeCloseTo(10);
        });

        it("should handle zero scale (identity)", () => {
            const points = [[5, 10, 1]];
            const transform = new Transform(points);
            const result = transform.scale(1, 1);
            expect(result[0][0]).toBeCloseTo(5);
            expect(result[0][1]).toBeCloseTo(10);
        });

        it("should handle zero rotation", () => {
            const points = [[5, 10, 1]];
            const transform = new Transform(points);
            const result = transform.rotate(0);
            expect(result[0][0]).toBeCloseTo(5, 5);
            expect(result[0][1]).toBeCloseTo(10, 5);
        });

        it("should handle negative values", () => {
            const points = [[5, 10, 1]];
            const transform = new Transform(points);
            const result = transform.move(-5, -10);
            expect(result[0][0]).toBeCloseTo(0);
            expect(result[0][1]).toBeCloseTo(0);
        });
    });
});
