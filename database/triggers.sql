-- =====================================================================
-- AIR-FLOW: TRIGGERS
-- File: database/triggers.sql
-- =====================================================================
-- Triggers are used sparingly — only where they add real value for
-- data consistency that cannot be handled by constraints alone.
--
-- This file also creates the audit_log table (15th supporting table)
-- to record selected data changes for faculty demonstration.
-- =====================================================================

USE air_flow_db;

-- =====================================================================
-- SUPPORTING TABLE: audit_log
-- Records selected data changes made by triggers.
-- This is a supporting table (15th), not part of the core 13+1 design.
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    log_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name    VARCHAR(50)  NOT NULL,
    record_id     BIGINT       NOT NULL,
    action        ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values    JSON,
    new_values    JSON,
    changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by    VARCHAR(50) DEFAULT 'SYSTEM'
) ENGINE=InnoDB;

-- =====================================================================
-- TRIGGER 1: trg_booking_status_audit
-- Logs changes to booking status for audit trail.
-- Fires AFTER UPDATE on bookings when booking_status changes.
-- =====================================================================
DELIMITER //

CREATE TRIGGER trg_booking_status_audit
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    IF OLD.booking_status <> NEW.booking_status THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
        VALUES (
            'bookings',
            NEW.booking_id,
            'UPDATE',
            JSON_OBJECT(
                'booking_status', OLD.booking_status,
                'total_amount', OLD.total_amount
            ),
            JSON_OBJECT(
                'booking_status', NEW.booking_status,
                'total_amount', NEW.total_amount
            )
        );
    END IF;
END //

DELIMITER ;

-- =====================================================================
-- TRIGGER 2: trg_payment_audit
-- Logs all payment inserts for audit trail.
-- Records payment type, status, and amount.
-- =====================================================================
DELIMITER //

CREATE TRIGGER trg_payment_audit
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
    VALUES (
        'payments',
        NEW.payment_id,
        'INSERT',
        NULL,
        JSON_OBJECT(
            'booking_id', NEW.booking_id,
            'amount', NEW.amount,
            'payment_type', NEW.payment_type,
            'payment_status', NEW.payment_status,
            'transaction_reference', NEW.transaction_reference
        )
    );
END //

DELIMITER ;

-- =====================================================================
-- TRIGGER 3: trg_flight_status_validate
-- Prevents invalid flight status transitions.
-- Allowed transitions:
--   SCHEDULED → BOARDING, CANCELLED
--   BOARDING  → COMPLETED, CANCELLED
--   COMPLETED → (no further changes)
--   CANCELLED → (no further changes)
-- =====================================================================
DELIMITER //

CREATE TRIGGER trg_flight_status_validate
BEFORE UPDATE ON flights
FOR EACH ROW
BEGIN
    IF OLD.flight_status <> NEW.flight_status THEN
        -- COMPLETED and CANCELLED are terminal states
        IF OLD.flight_status IN ('COMPLETED', 'CANCELLED') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Cannot change status of a completed or cancelled flight';
        END IF;

        -- SCHEDULED can only go to BOARDING or CANCELLED
        IF OLD.flight_status = 'SCHEDULED'
           AND NEW.flight_status NOT IN ('BOARDING', 'CANCELLED') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SCHEDULED flights can only transition to BOARDING or CANCELLED';
        END IF;

        -- BOARDING can only go to COMPLETED or CANCELLED
        IF OLD.flight_status = 'BOARDING'
           AND NEW.flight_status NOT IN ('COMPLETED', 'CANCELLED') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'BOARDING flights can only transition to COMPLETED or CANCELLED';
        END IF;

        -- Log the status change
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
        VALUES (
            'flights',
            NEW.flight_id,
            'UPDATE',
            JSON_OBJECT('flight_status', OLD.flight_status),
            JSON_OBJECT('flight_status', NEW.flight_status)
        );
    END IF;
END //

DELIMITER ;

-- =====================================================================
-- TRIGGER 4: trg_cancellation_audit
-- Logs cancellation records when they are created.
-- =====================================================================
DELIMITER //

CREATE TRIGGER trg_cancellation_audit
AFTER INSERT ON cancellations
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
    VALUES (
        'cancellations',
        NEW.cancellation_id,
        'INSERT',
        NULL,
        JSON_OBJECT(
            'booking_id', NEW.booking_id,
            'refund_amount', NEW.refund_amount,
            'cancellation_reason', COALESCE(NEW.cancellation_reason, 'N/A')
        )
    );
END //

DELIMITER ;

