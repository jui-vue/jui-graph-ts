/**
 * Transform utility module - ported from jui-graph's util/transform.js
 * Provides matrix-based 2D and 3D transformations
 */

/**
 * Convert degrees to radians
 * @param degree - angle in degrees
 * @returns number - angle in radians
 */
function radian(degree: number): number {
    return (degree * Math.PI) / 180;
}

/**
 * Perform 2D matrix multiplication (matrix vector multiply)
 * For a vector b, computes a * b where a is a 2D matrix
 * @param a - 2D matrix (array of Float32Array rows)
 * @param b - vector (array of numbers)
 * @returns array - resulting vector
 */
function matrix(a: (number[] | Float32Array)[], b: number[]): number[] {
    const m: number[] = [];

    for (let i = 0, len = a.length; i < len; i++) {
        let sum = 0;

        for (let j = 0, len2 = a[i].length; j < len2; j++) {
            sum += a[i][j] * b[j];
        }

        m.push(sum);
    }

    return m;
}

/**
 * Perform 2D deep matrix multiplication (matrix matrix multiply)
 * For matrices, computes a * b
 * @param a - transformation matrix
 * @param b - target matrix
 * @returns 2D array - resulting matrix
 */
function deepMatrix(a: (number[] | Float32Array)[], b: (number[] | Float32Array)[]): (number[] | Float32Array)[] {
    const m: number[][] = [];
    const nm: number[][] = [];

    for (let i = 0, len = b.length; i < len; i++) {
        m[i] = [];
        nm[i] = [];
    }

    for (let i = 0, len = b.length; i < len; i++) {
        for (let j = 0, len2 = b[i].length; j < len2; j++) {
            m[j].push(b[i][j]);
        }
    }

    for (let i = 0, len = m.length; i < len; i++) {
        const mm = matrix(a, m[i]);

        for (let j = 0, len2 = mm.length; j < len2; j++) {
            nm[j].push(mm[j]);
        }
    }

    return nm;
}

/**
 * Perform 3D matrix-vector multiplication
 * @param a - 4x4 transformation matrix
 * @param b - 4D vector
 * @returns Float32Array - resulting 4D vector
 */
function matrix3d(a: (number[] | Float32Array)[], b: number[]): Float32Array {
    const m = new Float32Array(4);

    m[0] = a[0][0] * b[0] + a[0][1] * b[1] + a[0][2] * b[2] + a[0][3] * b[3];
    m[1] = a[1][0] * b[0] + a[1][1] * b[1] + a[1][2] * b[2] + a[1][3] * b[3];
    m[2] = a[2][0] * b[0] + a[2][1] * b[1] + a[2][2] * b[2] + a[2][3] * b[3];
    m[3] = a[3][0] * b[0] + a[3][1] * b[1] + a[3][2] * b[2] + a[3][3] * b[3];

    return m;
}

/**
 * Perform 3D deep matrix multiplication (4x4 matrix matrix multiply)
 * @param a - transformation matrix
 * @param b - target matrix
 * @returns 2D array of Float32Array - resulting matrix
 */
function deepMatrix3d(a: (number[] | Float32Array)[], b: (number[] | Float32Array)[]): Float32Array[] {
    const nm: Float32Array[] = [
        new Float32Array(4),
        new Float32Array(4),
        new Float32Array(4),
        new Float32Array(4),
    ];

    const m: Float32Array[] = [
        new Float32Array([b[0][0], b[1][0], b[2][0], b[3][0]]),
        new Float32Array([b[0][1], b[1][1], b[2][1], b[3][1]]),
        new Float32Array([b[0][2], b[1][2], b[2][2], b[3][2]]),
        new Float32Array([b[0][3], b[1][3], b[2][3], b[3][3]]),
    ];

    nm[0][0] = a[0][0] * m[0][0] + a[0][1] * m[0][1] + a[0][2] * m[0][2] + a[0][3] * m[0][3];
    nm[1][0] = a[1][0] * m[0][0] + a[1][1] * m[0][1] + a[1][2] * m[0][2] + a[1][3] * m[0][3];
    nm[2][0] = a[2][0] * m[0][0] + a[2][1] * m[0][1] + a[2][2] * m[0][2] + a[2][3] * m[0][3];
    nm[3][0] = a[3][0] * m[0][0] + a[3][1] * m[0][1] + a[3][2] * m[0][2] + a[3][3] * m[0][3];

    nm[0][1] = a[0][0] * m[1][0] + a[0][1] * m[1][1] + a[0][2] * m[1][2] + a[0][3] * m[1][3];
    nm[1][1] = a[1][0] * m[1][0] + a[1][1] * m[1][1] + a[1][2] * m[1][2] + a[1][3] * m[1][3];
    nm[2][1] = a[2][0] * m[1][0] + a[2][1] * m[1][1] + a[2][2] * m[1][2] + a[2][3] * m[1][3];
    nm[3][1] = a[3][0] * m[1][0] + a[3][1] * m[1][1] + a[3][2] * m[1][2] + a[3][3] * m[1][3];

    nm[0][2] = a[0][0] * m[2][0] + a[0][1] * m[2][1] + a[0][2] * m[2][2] + a[0][3] * m[2][3];
    nm[1][2] = a[1][0] * m[2][0] + a[1][1] * m[2][1] + a[1][2] * m[2][2] + a[1][3] * m[2][3];
    nm[2][2] = a[2][0] * m[2][0] + a[2][1] * m[2][1] + a[2][2] * m[2][2] + a[2][3] * m[2][3];
    nm[3][2] = a[3][0] * m[2][0] + a[3][1] * m[2][1] + a[3][2] * m[2][2] + a[3][3] * m[2][3];

    nm[0][3] = a[0][0] * m[3][0] + a[0][1] * m[3][1] + a[0][2] * m[3][2] + a[0][3] * m[3][3];
    nm[1][3] = a[1][0] * m[3][0] + a[1][1] * m[3][1] + a[1][2] * m[3][2] + a[1][3] * m[3][3];
    nm[2][3] = a[2][0] * m[3][0] + a[2][1] * m[3][1] + a[2][2] * m[3][2] + a[2][3] * m[3][3];
    nm[3][3] = a[3][0] * m[3][0] + a[3][1] * m[3][1] + a[3][2] * m[3][2] + a[3][3] * m[3][3];

    return nm;
}

/**
 * Apply a matrix transformation to a vector
 * Dispatches to appropriate matrix multiplication based on dimensions
 * @param a - transformation matrix
 * @param b - vector to transform
 * @returns - transformed vector
 */
function matrixDispatch(a: (number[] | Float32Array)[], b: any): any {
    // Detect if this is a 3D matrix (4x4) or 2D matrix (3x3)
    const is3D = a.length === 4 && (a[0] as any).length === 4;

    if (Array.isArray(b) && b.length > 0) {
        const first = b[0];
        if (typeof first === "object" && (first instanceof Array || first instanceof Float32Array)) {
            // Matrix-matrix multiplication
            if (is3D) {
                return deepMatrix3d(a, b as (number[] | Float32Array)[]);
            }
            return deepMatrix(a, b as (number[] | Float32Array)[]);
        }
    }

    // Matrix-vector multiplication
    if (is3D) {
        return matrix3d(a, b as number[]);
    }
    return matrix(a, b as number[]);
}


/**
 * Transform class for applying matrix-based transformations to points
 */
export class Transform {
    public points: (number[] | Float32Array)[];

    constructor(points: (number[] | Float32Array)[]) {
        this.points = points;
    }

    /**
     * Calculate the transformation result
     * @param m - transformation matrix
     * @returns - transformed points
     */
    private calculate(m: (number[] | Float32Array)[]): (number[] | Float32Array)[] {
        for (let i = 0, count = this.points.length; i < count; i++) {
            this.points[i] = matrixDispatch(m, this.points[i]) as number[] | Float32Array;
        }

        return this.points;
    }

    /**
     * Create a transformation matrix
     * @param args - matrix type and parameters
     * @returns - transformation matrix
     */
    matrix(...args: any[]): (number[] | Float32Array)[] {
        const a = args;
        const type = a[0];

        if (type === "move") {
            return [
                new Float32Array([1, 0, a[1]]),
                new Float32Array([0, 1, a[2]]),
                new Float32Array([0, 0, 1]),
            ];
        } else if (type === "scale") {
            return [
                new Float32Array([a[1], 0, 0]),
                new Float32Array([0, a[2], 0]),
                new Float32Array([0, 0, 1]),
            ];
        } else if (type === "rotate") {
            return [
                new Float32Array([Math.cos(radian(a[1])), -Math.sin(radian(a[1])), 0]),
                new Float32Array([Math.sin(radian(a[1])), Math.cos(radian(a[1])), 0]),
                new Float32Array([0, 0, 1]),
            ];
        } else if (type === "move3d") {
            return [
                new Float32Array([1, 0, 0, a[1]]),
                new Float32Array([0, 1, 0, a[2]]),
                new Float32Array([0, 0, 1, a[3]]),
                new Float32Array([0, 0, 0, 1]),
            ];
        } else if (type === "scale3d") {
            return [
                new Float32Array([a[1], 0, 0, 0]),
                new Float32Array([0, a[2], 0, 0]),
                new Float32Array([0, 0, a[3], 0]),
                new Float32Array([0, 0, 0, 1]),
            ];
        } else if (type === "rotate3dz") {
            return [
                new Float32Array([Math.cos(radian(a[1])), -Math.sin(radian(a[1])), 0, 0]),
                new Float32Array([Math.sin(radian(a[1])), Math.cos(radian(a[1])), 0, 0]),
                new Float32Array([0, 0, 1, 0]),
                new Float32Array([0, 0, 0, 1]),
            ];
        } else if (type === "rotate3dx") {
            return [
                new Float32Array([1, 0, 0, 0]),
                new Float32Array([0, Math.cos(radian(a[1])), -Math.sin(radian(a[1])), 0]),
                new Float32Array([0, Math.sin(radian(a[1])), Math.cos(radian(a[1])), 0]),
                new Float32Array([0, 0, 0, 1]),
            ];
        } else if (type === "rotate3dy") {
            return [
                new Float32Array([Math.cos(radian(a[1])), 0, Math.sin(radian(a[1])), 0]),
                new Float32Array([0, 1, 0, 0]),
                new Float32Array([-Math.sin(radian(a[1])), 0, Math.cos(radian(a[1])), 0]),
                new Float32Array([0, 0, 0, 1]),
            ];
        }

        return [];
    }

    /**
     * Apply 2D translation
     * @param dx - x distance
     * @param dy - y distance
     * @returns - transformed points
     */
    move(dx: number, dy: number): (number[] | Float32Array)[] {
        return this.calculate(this.matrix("move", dx, dy));
    }

    /**
     * Apply 3D translation
     * @param dx - x distance
     * @param dy - y distance
     * @param dz - z distance
     * @returns - transformed points
     */
    move3d(dx: number, dy: number, dz: number): (number[] | Float32Array)[] {
        return this.calculate(this.matrix("move3d", dx, dy, dz));
    }

    /**
     * Apply 2D scaling
     * @param sx - x scale factor
     * @param sy - y scale factor
     * @returns - transformed points
     */
    scale(sx: number, sy: number): (number[] | Float32Array)[] {
        return this.calculate(this.matrix("scale", sx, sy));
    }

    /**
     * Apply 3D scaling
     * @param sx - x scale factor
     * @param sy - y scale factor
     * @param sz - z scale factor
     * @returns - transformed points
     */
    scale3d(sx: number, sy: number, sz: number): (number[] | Float32Array)[] {
        return this.calculate(this.matrix("scale3d", sx, sy, sz));
    }

    /**
     * Apply 2D rotation
     * @param angle - rotation angle in degrees
     * @returns - transformed points
     */
    rotate(angle: number): (number[] | Float32Array)[] {
        return this.calculate(this.matrix("rotate", angle));
    }

    /**
     * Apply 3D rotation around Z axis (ROLL)
     * @param angle - rotation angle in degrees
     * @returns - transformed points
     */
    rotate3dz(angle: number): (number[] | Float32Array)[] {
        return this.calculate(this.matrix("rotate3dz", angle));
    }

    /**
     * Apply 3D rotation around X axis (PITCH)
     * @param angle - rotation angle in degrees
     * @returns - transformed points
     */
    rotate3dx(angle: number): (number[] | Float32Array)[] {
        return this.calculate(this.matrix("rotate3dx", angle));
    }

    /**
     * Apply 3D rotation around Y axis (YAW)
     * @param angle - rotation angle in degrees
     * @returns - transformed points
     */
    rotate3dy(angle: number): (number[] | Float32Array)[] {
        return this.calculate(this.matrix("rotate3dy", angle));
    }

    /**
     * Apply a custom matrix transformation
     * @param m - transformation matrix
     * @returns - transformed points
     */
    custom(m: (number[] | Float32Array)[]): (number[] | Float32Array)[] {
        return this.calculate(m);
    }

    /**
     * Merge multiple transformations into one
     * @param args - arrays of transformation arguments (e.g., ["move", 1, 2], ["scale", 2, 2])
     * @returns - transformed points
     */
    merge(...args: any[]): (number[] | Float32Array)[] {
        let m = this.matrix(...args[0]);

        for (let i = 1; i < args.length; i++) {
            const nextMatrix = this.matrix(...args[i]);
            m = matrixDispatch(m, nextMatrix);
        }

        return this.calculate(m);
    }

    /**
     * Merge transformations with callback for per-point customization
     * @param callback - function that returns transformation arguments for each point
     */
    merge2(callback: (point: number[] | Float32Array) => any[]): void {
        for (let i = 0, count = this.points.length; i < count; i++) {
            const a = callback(this.points[i]);
            let m = this.matrix(...a[0]);

            for (let j = 1; j < a.length; j++) {
                const nextMatrix = this.matrix(...a[j]);
                m = matrixDispatch(m, nextMatrix);
            }

            this.points[i] = matrixDispatch(m, this.points[i]);
        }
    }
}
