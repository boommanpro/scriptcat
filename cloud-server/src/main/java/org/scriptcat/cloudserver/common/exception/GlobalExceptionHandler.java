package org.scriptcat.cloudserver.common.exception;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.common.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        log.error("Business exception: {}", e.getMessage(), e);
        return ResponseEntity.badRequest()
            .body(ApiResponse.error(e.getErrorCode(), e.getMessage()));
    }
    
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(IllegalArgumentException e) {
        log.error("Illegal argument: {}", e.getMessage(), e);
        return ResponseEntity.badRequest()
            .body(ApiResponse.error("INVALID_ARGUMENT", e.getMessage()));
    }
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("Unexpected error", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.error("INTERNAL_ERROR", "Internal server error"));
    }
}
