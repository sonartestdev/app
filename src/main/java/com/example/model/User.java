package com.example.model;

import java.util.Date;
import java.util.List;

/**
 * User model — intentionally includes SonarQube-detectable issues:
 * - Mutable Date field exposed via getter (S2384)
 * - Missing equals/hashCode override (S1206)
 * - Public mutable fields (S1104)
 * - Unused private field (S1068)
 */
public class User {

    public String name;             // S1104: public mutable field
    private String email;
    private String password;        // S2068: hardcoded credential field name
    private Date createdAt;
    private List<String> roles;
    private String unusedField;     // S1068: unused private field
    private int loginAttempts;

    public User() {}

    public User(String name, String email, String password) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.createdAt = new Date();
    }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    // S2384: returns mutable internal Date — should return defensive copy
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    // S2384: returns mutable internal List
    public List<String> getRoles() { return roles; }
    public void setRoles(List<String> roles) { this.roles = roles; }

    public int getLoginAttempts() { return loginAttempts; }
    public void setLoginAttempts(int loginAttempts) { this.loginAttempts = loginAttempts; }

    // No equals(), hashCode(), or toString() — S1206
}
