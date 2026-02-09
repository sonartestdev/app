package com.example.model;

import java.util.Objects;

/**
 * Product model — clean implementation for contrast.
 * SonarQube should report zero issues on this class.
 */
public final class Product {

    private final String id;
    private final String name;
    private final double price;

    public Product(String id, String name, double price) {
        this.id = Objects.requireNonNull(id, "id must not be null");
        this.name = Objects.requireNonNull(name, "name must not be null");
        if (price < 0) {
            throw new IllegalArgumentException("price must be non-negative");
        }
        this.price = price;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public double getPrice() { return price; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Product product)) return false;
        return Double.compare(product.price, price) == 0
                && id.equals(product.id)
                && name.equals(product.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, price);
    }

    @Override
    public String toString() {
        return "Product{id='%s', name='%s', price=%.2f}".formatted(id, name, price);
    }
}
