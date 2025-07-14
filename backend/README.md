# Payroll Management System
A simple system for handling employee payroll processes, including salary calculations, deductions, bonuses, tax management, leave tracking, and payments.

## Features
- Employee Management – Store and manage employee details, salaries, and job roles.
- Payroll Processing – Automate salary calculations, overtime, bonuses, and deductions.
- Payments and Bank Transfers – Record salary payments using different payment methods.
- Deductions and Taxes – Automatically calculate tax deductions, insurance, and other contributions.
- Leave Management – Track employee leave requests and approvals.
- Benefits Management – Manage employee benefits such as medical and travel allowances.

## Installation and Setup
1. Clone the repository:
   ```sh
   git clone https://github.com/IsaacVic-Dark/payhub.git
   cd payhub
   ```
2. Set up the database (MySQLv8+).
3. Rename the `.env.example` file to `.env` and configure your database connection settings.
4. Install Composer dependencies:
   ```sh
   composer install
   ```
5. Run the database migrations:
   ```sh
   mysql -u <your-username> -p payhub < $(pwd)/backend/database/schema.sql
   ```

## Usage
1. Start the server:
   ```sh
   php -S localhost:8000 -t backend
   ```
2. Access the application in your web browser at `http://localhost:8000`.

## Contributing
Contributions are welcome. You can open an issue or submit a pull request.
