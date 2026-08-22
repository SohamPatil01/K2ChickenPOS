-- Remove BI expense/budget tables (reporting module rollback)
DROP TABLE IF EXISTS "Budget";
DROP TABLE IF EXISTS "Expense";
DROP TABLE IF EXISTS "ExpenseCategory";
DROP TYPE IF EXISTS "BudgetStatus";
DROP TYPE IF EXISTS "BudgetPeriodType";
DROP TYPE IF EXISTS "ExpenseStatus";
