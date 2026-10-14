package com.callsheet.scheduling.service;

public class NotFoundException extends RuntimeException {
    public NotFoundException(String what, Object id) {
        super("%s %s not found".formatted(what, id));
    }
}
