package com.example.service;

import com.example.model.User;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * UserService — intentionally includes SonarQube-detectable issues:
 * - SQL injection vulnerability (S3649)
 * - Hardcoded credentials (S2068)
 * - Empty catch blocks (S108)
 * - Resource leak — unclosed connection (S2095)
 * - Cognitive complexity too high (S3776)
 * - NullPointerException risk (S2259)
 */
public class UserService {

    // S2068: hardcoded credentials
    private static final String DB_URL = "jdbc:mysql://localhost:3306/users";
    private static final String DB_USER = "admin";
    private static final String DB_PASSWORD = "password123";

    private List<User> userCache = new ArrayList<>();

    // ---- SQL INJECTION (S3649) & RESOURCE LEAK (S2095) ----

    public User findUserByName(String name) {
        Connection conn = null;
        try {
            conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
            Statement stmt = conn.createStatement();
            // S3649: SQL injection — user input concatenated directly
            String query = "SELECT * FROM users WHERE name = '" + name + "'";
            ResultSet rs = stmt.executeQuery(query);
            if (rs.next()) {
                User user = new User();
                user.name = rs.getString("name");
                user.setEmail(rs.getString("email"));
                return user;
            }
        } catch (Exception e) {
            // S108: empty catch block
        }
        // S2095: connection never closed in finally block
        return null;
    }

    // ---- HIGH COGNITIVE COMPLEXITY (S3776) ----

    public String classifyUser(User user) {
        if (user == null) {
            return "unknown";
        }
        String result = "";
        if (user.getLoginAttempts() > 10) {
            if (user.getRoles() != null) {
                for (String role : user.getRoles()) {
                    if (role.equals("admin")) {
                        if (user.getLoginAttempts() > 50) {
                            result = "suspicious_admin";
                        } else {
                            result = "active_admin";
                        }
                    } else if (role.equals("moderator")) {
                        if (user.getLoginAttempts() > 30) {
                            result = "active_moderator";
                        } else {
                            result = "moderator";
                        }
                    } else {
                        if (user.getLoginAttempts() > 100) {
                            result = "power_user";
                        } else {
                            result = "regular";
                        }
                    }
                }
            } else {
                result = "no_roles";
            }
        } else {
            result = "inactive";
        }
        return result;
    }

    // ---- NULL DEREFERENCE (S2259) ----

    public String getUserDomain(User user) {
        // S2259: potential NullPointerException — email could be null
        String email = user.getEmail();
        return email.substring(email.indexOf("@") + 1);
    }

    // ---- DUPLICATED CODE BLOCK 1 ----

    public List<User> filterActiveAdmins(List<User> users) {
        List<User> result = new ArrayList<>();
        for (User user : users) {
            if (user.getRoles() != null) {
                for (String role : user.getRoles()) {
                    if (role.equals("admin") && user.getLoginAttempts() > 5) {
                        result.add(user);
                    }
                }
            }
        }
        return result;
    }

    // ---- DUPLICATED CODE BLOCK 2 (near-clone of above) ----

    public List<User> filterActiveModerators(List<User> users) {
        List<User> result = new ArrayList<>();
        for (User user : users) {
            if (user.getRoles() != null) {
                for (String role : user.getRoles()) {
                    if (role.equals("moderator") && user.getLoginAttempts() > 5) {
                        result.add(user);
                    }
                }
            }
        }
        return result;
    }

    // ---- REGEX DOS (S5852) ----

    public boolean isValidEmail(String email) {
        // S5852: catastrophic backtracking possible
        Pattern pattern = Pattern.compile("^([a-zA-Z0-9]+\\.?)+@([a-zA-Z0-9]+\\.?)+$");
        return pattern.matcher(email).matches();
    }
}
