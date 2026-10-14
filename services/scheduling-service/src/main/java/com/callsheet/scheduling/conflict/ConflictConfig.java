package com.callsheet.scheduling.conflict;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class ConflictConfig {

    @Bean
    ConflictDetector conflictDetector(@Value("${callsheet.scheduling.min-turnaround-hours:10}") long hours) {
        return new ConflictDetector(Duration.ofHours(hours));
    }
}
