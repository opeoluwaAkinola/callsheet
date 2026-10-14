package com.callsheet.scheduling.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShootDayRepository extends JpaRepository<ShootDay, Long> {
    List<ShootDay> findByProductionIdOrderByCallAt(Long productionId);
}
