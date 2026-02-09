package com.example.service;

import com.example.model.Product;
import org.junit.Before;
import org.junit.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.Assert.*;

/**
 * Tests for ProductService — good coverage.
 * UserService and SecurityUtil are intentionally untested (low coverage).
 */
public class ProductServiceTest {

    private ProductService service;

    @Before
    public void setUp() {
        service = new ProductService();
        service.addProduct(new Product("1", "Laptop", 999.99));
        service.addProduct(new Product("2", "Mouse", 29.99));
        service.addProduct(new Product("3", "Keyboard", 79.99));
    }

    @Test
    public void testFindById_existing() {
        Optional<Product> result = service.findById("1");
        assertTrue(result.isPresent());
        assertEquals("Laptop", result.get().getName());
    }

    @Test
    public void testFindById_notFound() {
        Optional<Product> result = service.findById("999");
        assertFalse(result.isPresent());
    }

    @Test
    public void testFindByPriceRange() {
        List<Product> affordable = service.findByPriceRange(20, 100);
        assertEquals(2, affordable.size());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testFindByPriceRange_invalidRange() {
        service.findByPriceRange(100, 10);
    }

    @Test
    public void testCalculateTotal() {
        List<Product> all = service.getAllProducts();
        double total = service.calculateTotal(all);
        assertEquals(1109.97, total, 0.01);
    }

    @Test
    public void testRemoveProduct() {
        assertTrue(service.removeProduct("2"));
        assertEquals(2, service.getAllProducts().size());
    }

    @Test
    public void testRemoveProduct_notFound() {
        assertFalse(service.removeProduct("nonexistent"));
    }

    @Test(expected = IllegalArgumentException.class)
    public void testAddNullProduct() {
        service.addProduct(null);
    }

    @Test
    public void testGetAllProducts_immutable() {
        List<Product> products = service.getAllProducts();
        try {
            products.add(new Product("4", "Monitor", 399.99));
            fail("Should have thrown UnsupportedOperationException");
        } catch (UnsupportedOperationException e) {
            // expected
        }
    }
}
