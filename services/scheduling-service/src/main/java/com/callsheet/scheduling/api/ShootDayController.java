package com.callsheet.scheduling.api;

import com.callsheet.scheduling.api.Dtos.*;
import com.callsheet.scheduling.service.SchedulingService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ShootDayController {

    private final SchedulingService service;

    public ShootDayController(SchedulingService service) {
        this.service = service;
    }

    @GetMapping("/shoot-days/{id}")
    public ShootDayView get(@PathVariable Long id) {
        return ShootDayView.of(service.getShootDay(id));
    }

    @PatchMapping("/shoot-days/{id}")
    public ShootDayView update(@PathVariable Long id, @Valid @RequestBody UpdateShootDay req) {
        return ShootDayView.of(service.updateShootDay(id, req));
    }

    @PostMapping("/shoot-days/{id}/assignments")
    public ResponseEntity<AssignmentView> assign(@PathVariable Long id, @Valid @RequestBody CreateAssignment req) {
        AssignmentView view = AssignmentView.of(service.assign(id, req));
        return ResponseEntity.created(URI.create("/api/assignments/" + view.id())).body(view);
    }

    @DeleteMapping("/assignments/{id}")
    public ResponseEntity<Void> unassign(@PathVariable Long id) {
        service.unassign(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/crew/{crewMemberId}/schedule")
    public List<CrewScheduleEntry> schedule(@PathVariable String crewMemberId) {
        return service.scheduleFor(crewMemberId).stream().map(CrewScheduleEntry::of).toList();
    }

    /** Dry run: would assigning this crew member to this shoot day cause a conflict? */
    @PostMapping("/conflicts/check")
    public ConflictCheckResult check(@Valid @RequestBody ConflictCheckRequest req) {
        var conflicts = service.check(req);
        return new ConflictCheckResult(conflicts.isEmpty(), conflicts);
    }
}
