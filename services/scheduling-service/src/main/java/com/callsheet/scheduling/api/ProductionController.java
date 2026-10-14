package com.callsheet.scheduling.api;

import com.callsheet.scheduling.api.Dtos.*;
import com.callsheet.scheduling.service.SchedulingService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/productions")
public class ProductionController {

    private final SchedulingService service;

    public ProductionController(SchedulingService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProductionView> list() {
        return service.listProductions().stream().map(ProductionView::of).toList();
    }

    @GetMapping("/{id}")
    public ProductionView get(@PathVariable Long id) {
        return ProductionView.of(service.getProduction(id));
    }

    @PostMapping
    public ResponseEntity<ProductionView> create(@Valid @RequestBody CreateProduction req) {
        ProductionView view = ProductionView.of(service.createProduction(req));
        return ResponseEntity.created(URI.create("/api/productions/" + view.id())).body(view);
    }

    @GetMapping("/{id}/shoot-days")
    public List<ShootDayView> shootDays(@PathVariable Long id) {
        return service.listShootDays(id).stream().map(ShootDayView::of).toList();
    }

    @PostMapping("/{id}/shoot-days")
    public ResponseEntity<ShootDayView> createShootDay(@PathVariable Long id, @Valid @RequestBody CreateShootDay req) {
        ShootDayView view = ShootDayView.of(service.createShootDay(id, req));
        return ResponseEntity.created(URI.create("/api/shoot-days/" + view.id())).body(view);
    }
}
