package com.callsheet.scheduling.service;

public class StaleVersionException extends RuntimeException {
    public StaleVersionException(Long id, long expected, long actual) {
        super("Shoot day %d was changed by someone else (you have version %d, current is %d). Reload and try again."
                .formatted(id, expected, actual));
    }
}
