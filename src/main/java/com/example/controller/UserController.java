package com.example.controller;

import com.example.model.User;
import com.example.service.UserService;
import com.example.util.SecurityUtil;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.logging.Logger;

/**
 * UserController — intentionally includes SonarQube-detectable issues:
 * - XSS vulnerability: unescaped user input in HTML (S5131)
 * - Stack trace exposure (S1148)
 * - God method / long method (S138)
 * - Magic numbers (S109)
 * - Dead store (S1854)
 */
public class UserController {

    private static final Logger LOGGER = Logger.getLogger(UserController.class.getName());
    private final UserService userService = new UserService();

    // S5131: reflected XSS — user input embedded in HTML without escaping
    public String renderUserProfile(String username) {
        User user = userService.findUserByName(username);

        // S1854: dead store — html is overwritten below
        String html = "";

        if (user != null) {
            html = "<html><body>"
                    + "<h1>Welcome, " + user.name + "</h1>"   // XSS if name is unsanitized
                    + "<p>Email: " + user.getEmail() + "</p>"
                    + "</body></html>";
        } else {
            // S5131: reflecting unsanitized input back to page
            html = "<html><body>"
                    + "<h1>User not found: " + username + "</h1>"
                    + "</body></html>";
        }
        return html;
    }

    // S1148: stack trace printed to response, exposes internals
    public String handleRequest(String action, String data) {
        try {
            return switch (action) {
                case "hash" -> SecurityUtil.hashPassword(data);
                case "token" -> SecurityUtil.generateToken(32);
                case "read" -> new String(SecurityUtil.readFile(data));
                case "classify" -> {
                    User u = userService.findUserByName(data);
                    yield userService.classifyUser(u);
                }
                default -> "Unknown action";
            };
        } catch (Exception e) {
            // S1148: printing stack trace to end user
            StringWriter sw = new StringWriter();
            e.printStackTrace(new PrintWriter(sw));
            return "<pre>" + sw + "</pre>";
        }
    }

    // S109: magic numbers scattered throughout
    public String rateLimit(User user) {
        if (user.getLoginAttempts() > 100) {
            return "blocked";
        } else if (user.getLoginAttempts() > 50) {
            return "captcha_required";
        } else if (user.getLoginAttempts() > 10) {
            return "warning";
        }
        return "ok";
    }

    // S1135: TODO left in code
    public void auditLog(String action, String userId) {
        // TODO: implement proper audit logging
        System.out.println("AUDIT: " + action + " by " + userId);  // S106
    }
}
