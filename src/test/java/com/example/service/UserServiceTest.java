package com.example.service;

import com.example.model.User;
import org.junit.Test;

import static org.junit.Assert.*;

/**
 * Intentionally minimal tests for UserService — demonstrates low coverage.
 * SonarQube will flag coverage gaps on untested methods.
 */
public class UserServiceTest {

    @Test
    public void testClassifyUser_null() {
        UserService service = new UserService();
        assertEquals("unknown", service.classifyUser(null));
    }

    @Test
    public void testClassifyUser_inactive() {
        UserService service = new UserService();
        User user = new User("test", "test@example.com", "pass");
        user.setLoginAttempts(3);
        assertEquals("inactive", service.classifyUser(user));
    }

    // Many methods intentionally left untested:
    // - findUserByName (SQL injection path)
    // - getUserDomain (NPE path)
    // - filterActiveAdmins
    // - filterActiveModerators
    // - isValidEmail
}
