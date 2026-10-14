package com.callsheet.scheduling.api;

import com.callsheet.scheduling.service.NotFoundException;
import com.callsheet.scheduling.service.SchedulingConflictException;
import com.callsheet.scheduling.service.StaleVersionException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Every error is an RFC 9457 problem+json response. */
@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, "Not found", e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail badRequest(IllegalArgumentException e) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", e.getMessage());
    }

    @ExceptionHandler(SchedulingConflictException.class)
    ProblemDetail conflict(SchedulingConflictException e) {
        ProblemDetail pd = problem(HttpStatus.CONFLICT, "Scheduling conflict", e.getMessage());
        pd.setProperty("crewMemberId", e.getCrewMemberId());
        pd.setProperty("conflicts", e.getConflicts());
        return pd;
    }

    @ExceptionHandler({StaleVersionException.class, ObjectOptimisticLockingFailureException.class})
    ProblemDetail stale(RuntimeException e) {
        return problem(HttpStatus.CONFLICT, "Stale update", e.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail integrity(DataIntegrityViolationException e) {
        return problem(HttpStatus.CONFLICT, "Data integrity violation", "The request conflicts with existing data");
    }

    private static ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setTitle(title);
        return pd;
    }
}
