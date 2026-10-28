
CREATE TABLE waste_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    waste_description TEXT,

    waste_quantity NUMERIC(10, 2) NOT NULL
        CHECK (waste_quantity > 0),

    quantity_unit VARCHAR(20) NOT NULL
        CHECK (quantity_unit IN ('kg', 'bags', 'm3')),

    location GEOGRAPHY(POINT, 4326) NOT NULL,

    road_condition VARCHAR(20) NOT NULL
        CHECK (
            road_condition IN (
                'good',
                'damaged',
                'blocked',
                'unknown'
            )
        ),

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'verified',
                'assigned',
                'collected',
                'rejected'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waste_reports_location
ON waste_reports
USING GIST (location);
