# SonarQube Test Project

A concise Java codebase designed to exercise SonarQube's analysis capabilities across all major dimensions: **Bugs**, **Vulnerabilities**, **Security Hotspots**, **Code Smells**, **Duplications**, and **Coverage**.

## Project Structure

```
src/main/java/com/example/
├── model/
│   ├── User.java          ← Code smells (mutable fields, missing equals/hashCode)
│   └── Product.java       ← Clean reference implementation
├── service/
│   ├── UserService.java   ← Bugs + Vulnerabilities (SQL injection, NPE, resource leaks)
│   └── ProductService.java← Clean reference implementation
├── util/
│   └── SecurityUtil.java  ← Security hotspots (weak crypto, insecure RNG, path traversal)
└── controller/
    └── UserController.java← XSS, stack trace exposure, magic numbers

src/test/java/com/example/service/
├── ProductServiceTest.java ← High coverage (clean code path)
└── UserServiceTest.java    ← Low coverage (intentional gaps)
```

## What SonarQube Will Detect

| Category           | File(s)               | Examples                                          |
|--------------------|-----------------------|---------------------------------------------------|
| **Bugs**           | UserService           | NullPointerException, resource leaks              |
| **Vulnerabilities**| UserService, SecurityUtil | SQL injection, path traversal, ReDoS          |
| **Security Hotspots** | SecurityUtil, UserController | MD5 hash, insecure Random, XSS, stack trace |
| **Code Smells**    | User, UserController  | Unused fields, magic numbers, high complexity     |
| **Duplications**   | UserService           | filterActiveAdmins / filterActiveModerators       |
| **Low Coverage**   | UserService, SecurityUtil, UserController | Untested methods           |

## Running the Analysis

### Prerequisites
- Java 17+
- Maven 3.8+
- SonarQube server running (localhost:9000 default)

### Steps

```bash
# 1. Build and run tests with coverage
mvn clean verify

# 2. Run SonarQube analysis (adjust URL/token as needed)
mvn sonar:sonar \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=YOUR_SONAR_TOKEN

# Or with standalone scanner:
sonar-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=YOUR_SONAR_TOKEN
```

### With Docker (quick start)

```bash
# Start SonarQube
docker run -d --name sonarqube -p 9000:9000 sonarqube:community

# Wait for startup, then navigate to http://localhost:9000
# Default credentials: admin / admin
# Create a project token, then run the Maven commands above
```

## Clean vs. Dirty Code

The project includes **clean** (`Product`, `ProductService`) and **intentionally flawed** (`User`, `UserService`, `SecurityUtil`, `UserController`) implementations side by side. This contrast helps demonstrate how SonarQube differentiates between well-written and problematic code in the same project.
# app
