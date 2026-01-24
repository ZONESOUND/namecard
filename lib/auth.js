import { SignJWT, jwtVerify } from "jose";

const secretKey = process.env.JWT_SECRET || "default-secret-key-change-me";
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h") // Session lasts 24 hours
        .sign(key);
}

export async function decrypt(input) {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ["HS256"],
    });
    return payload;
}

export async function verifySession(request) {
    const cookie = request.cookies.get("session")?.value;
    if (!cookie) return null;

    try {
        const session = await decrypt(cookie);
        return session;
    } catch (err) {
        return null;
    }
}
