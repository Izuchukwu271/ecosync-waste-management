
CREATE TABLE app_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL
        CHECK (
            role IN (
                'reporter',
                'waste_management_team',
                'system_administrator'
            )
        ),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE waste_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    
reporter_id BIGINT NOT NULL
    REFERENCES app_users(id)
    ON DELETE RESTRICT,


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


CREATE INDEX idx_waste_reports_reporter_id
ON waste_reports (reporter_id);

