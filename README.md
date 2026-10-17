# DormPASS Admin Console

The **DormPASS Admin Console** is the web-based administration interface for managing the DormPASS hostel attendance and student residential services platform.

It provides administrators with centralized control over hostels, wardens, students, rooms, attendance configuration, and system activity.

---

## Overview

DormPASS follows a multi-application architecture:

- **Admin Console** — Used by administrators to manage the entire system.
- **Warden App** — Used by hostel wardens to manage students and attendance.
- **Student App** — Used by students for authentication and attendance-related services.
- **Backend API** — Handles authentication, database operations, student activation, attendance, and other business logic.
- **PostgreSQL** — Stores DormPASS application data.

The Admin Console is intended for administrative operations rather than day-to-day student attendance.

---

## Features

### Dashboard

Provides an overview of the DormPASS system and its current state.

### Warden Management

Administrators can:

- Create warden accounts
- Manage existing wardens
- Associate wardens with hostels
- Manage warden account information
- Control access to the Warden Console

Warden accounts are administrator-created accounts. Wardens do not create their own accounts.

---

### Hostel Management

Administrators can create and manage hostels.

Hostel configuration includes:

- Hostel name
- Block / location information
- Geofence configuration
- Attendance window
- Assigned warden
- Hostel-related room information

Example hostel configuration:

```text
Hostel
 ├── Name
 ├── Location / Geofence
 ├── Attendance Window
 ├── Warden
 └── Rooms
