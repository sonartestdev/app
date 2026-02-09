package com.example.util;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Random;

/**
 * SecurityUtil — intentionally includes SonarQube-detectable issues:
 * - Weak cryptographic hash (S4790)
 * - Insecure random number generator (S2245)
 * - Path traversal risk (S2083)
 * - System.out usage (S106)
 * - Commented-out code (S125)
 */
public class SecurityUtil {

    // S2245: using insecure Random instead of SecureRandom
    private static final Random RANDOM = new Random();

    // S4790: MD5 is a weak hash algorithm
    public static String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(password.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // S106: using System.out instead of a logger
            System.out.println("Hash error: " + e.getMessage());
            return null;
        }
    }

    // S2245: insecure random for security-sensitive token generation
    public static String generateToken(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder token = new StringBuilder();
        for (int i = 0; i < length; i++) {
            token.append(chars.charAt(RANDOM.nextInt(chars.length())));
        }
        return token.toString();
    }

    // S2083: path traversal — unsanitized user input in file path
    public static byte[] readFile(String userProvidedPath) throws IOException {
        File file = new File("/data/uploads/" + userProvidedPath);
        try (FileInputStream fis = new FileInputStream(file)) {
            return fis.readAllBytes();
        }
    }

    // S125: commented-out code block
    // public static String encryptAES(String data, String key) {
    //     Cipher cipher = Cipher.getInstance("AES");
    //     cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key.getBytes(), "AES"));
    //     return Base64.getEncoder().encodeToString(cipher.doFinal(data.getBytes()));
    // }

    // S1172: unused parameter 'salt'
    public static boolean verifyPassword(String input, String storedHash, String salt) {
        String hashed = hashPassword(input);
        return hashed != null && hashed.equals(storedHash);
    }
}
