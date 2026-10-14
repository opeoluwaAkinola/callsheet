package com.callsheet.scheduling.domain;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    @Query("""
            select a from Assignment a join fetch a.shootDay d join fetch d.production
            where a.crewMemberId = :crewMemberId order by d.callAt""")
    List<Assignment> findByCrewMember(@Param("crewMemberId") String crewMemberId);

    /** Assignments for a crew member whose shoot day falls inside [from, to). Used for conflict checks. */
    @Query("""
            select a from Assignment a join fetch a.shootDay d join fetch d.production
            where a.crewMemberId = :crewMemberId and d.wrapAt > :from and d.callAt < :to""")
    List<Assignment> findByCrewMemberBetween(@Param("crewMemberId") String crewMemberId,
                                             @Param("from") LocalDateTime from,
                                             @Param("to") LocalDateTime to);
}
