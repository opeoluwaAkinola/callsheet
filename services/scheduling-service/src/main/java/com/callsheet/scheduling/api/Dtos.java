package com.callsheet.scheduling.api;

import com.callsheet.scheduling.conflict.Conflict;
import com.callsheet.scheduling.domain.Assignment;
import com.callsheet.scheduling.domain.Production;
import com.callsheet.scheduling.domain.ShootDay;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Request and response shapes. Entities never leave the service layer. */
public final class Dtos {

    private Dtos() {}

    public record CreateProduction(@NotBlank @Size(max = 200) String title,
                                   @NotNull LocalDate startDate,
                                   @NotNull LocalDate endDate) {}

    public record ProductionView(Long id, String title, LocalDate startDate, LocalDate endDate) {
        static ProductionView of(Production p) {
            return new ProductionView(p.getId(), p.getTitle(), p.getStartDate(), p.getEndDate());
        }
    }

    public record CreateShootDay(@NotBlank @Size(max = 50) String unit,
                                 @NotBlank @Size(max = 200) String locationName,
                                 @NotNull LocalDateTime callAt,
                                 @NotNull LocalDateTime wrapAt,
                                 @Size(max = 2000) String notes) {}

    /** Partial update. {@code version} must match the version the client last read. */
    public record UpdateShootDay(@NotNull Long version,
                                 @Size(max = 200) String locationName,
                                 LocalDateTime callAt,
                                 LocalDateTime wrapAt,
                                 @Size(max = 2000) String notes) {}

    public record ShootDayView(Long id, Long productionId, String productionTitle, String unit,
                               String locationName, LocalDateTime callAt, LocalDateTime wrapAt,
                               String notes, long version, List<AssignmentView> assignments) {
        static ShootDayView of(ShootDay d) {
            return new ShootDayView(d.getId(), d.getProduction().getId(), d.getProduction().getTitle(),
                    d.getUnit(), d.getLocationName(), d.getCallAt(), d.getWrapAt(), d.getNotes(),
                    d.getVersion(), d.getAssignments().stream().map(AssignmentView::of).toList());
        }
    }

    public record CreateAssignment(@NotBlank @Size(max = 64) String crewMemberId,
                                   @NotBlank @Size(max = 100) String role) {}

    public record AssignmentView(Long id, Long shootDayId, String crewMemberId, String role) {
        static AssignmentView of(Assignment a) {
            return new AssignmentView(a.getId(), a.getShootDay().getId(), a.getCrewMemberId(), a.getRole());
        }
    }

    public record CrewScheduleEntry(Long assignmentId, String role, Long shootDayId, String productionTitle,
                                    String unit, String locationName, LocalDateTime callAt, LocalDateTime wrapAt) {
        static CrewScheduleEntry of(Assignment a) {
            ShootDay d = a.getShootDay();
            return new CrewScheduleEntry(a.getId(), a.getRole(), d.getId(), d.getProduction().getTitle(),
                    d.getUnit(), d.getLocationName(), d.getCallAt(), d.getWrapAt());
        }
    }

    public record ConflictCheckRequest(@NotBlank String crewMemberId, @NotNull Long shootDayId) {}

    public record ConflictCheckResult(boolean ok, List<Conflict> conflicts) {}
}
