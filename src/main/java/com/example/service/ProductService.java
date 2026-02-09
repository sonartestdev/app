package com.example.service;

import com.example.model.Product;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * ProductService — clean implementation demonstrating good practices.
 * SonarQube should find minimal or zero issues here.
 */
public class ProductService {

    private final List<Product> products = new ArrayList<>();

    public void addProduct(Product product) {
        if (product == null) {
            throw new IllegalArgumentException("Product must not be null");
        }
        products.add(product);
    }

    public Optional<Product> findById(String id) {
        return products.stream()
                .filter(p -> p.getId().equals(id))
                .findFirst();
    }

    public List<Product> findByPriceRange(double min, double max) {
        if (min < 0 || max < min) {
            throw new IllegalArgumentException("Invalid price range: [%s, %s]".formatted(min, max));
        }
        return products.stream()
                .filter(p -> p.getPrice() >= min && p.getPrice() <= max)
                .toList();
    }

    public List<Product> getAllProducts() {
        return Collections.unmodifiableList(products);
    }

    public double calculateTotal(List<Product> items) {
        return items.stream()
                .mapToDouble(Product::getPrice)
                .sum();
    }

    public boolean removeProduct(String id) {
        return products.removeIf(p -> p.getId().equals(id));
    }
}
