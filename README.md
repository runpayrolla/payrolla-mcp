# Payrolla MCP Server

MCP (Model Context Protocol) server for Turkish payroll calculations and budget simulations. Enables LLMs to calculate payroll, simulate budgets, and compare what-if scenarios.

## Installation

```bash
npm install -g payrolla-mcp
```

Or run directly with npx:

```bash
npx payrolla-mcp
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYROLLA_API_KEY` | Yes | API key for Payrolla service |
| `PAYROLLA_DEBUG` | No | Set to `true` for debug logging |

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payrolla": {
      "command": "npx",
      "args": ["payrolla-mcp"],
      "env": {
        "PAYROLLA_API_KEY": "pk_live_xxxxx"
      }
    }
  }
}
```

## Available Tools

### calculate_payroll

Calculate payroll for a single employee.

**Input:**
- `name` - Employee name
- `wage` - Wage amount
- `calculationType` - 'Gross' or 'Net'
- `year` - Calculation year
- `month` - Starting month (1-12)
- `periodCount` - Number of months (optional, default: 1)
- `ssiType` - SSI type: 'S4A', 'S4B', or 'S4C' (optional, default: 'S4A')
- `extraPayments` - Array of extra payments (optional)
- `customParams` - Custom global parameters (optional)

### calculate_bulk_payroll

Calculate payroll for multiple employees with shared parameters.

**Input:**
- `employees` - Array of employee objects
- `year` - Calculation year
- `month` - Starting month
- `periodCount` - Number of months (use 12 for yearly)
- `customParams` - Shared custom parameters (optional)

### simulate_budget

Simulate budget with what-if scenarios.

**Input:**
- `employees` - Array of employees
- `year` - Calculation year
- `periodCount` - Number of months
- `scenario` - Scenario configuration:
  - `salaryRaisePercent` - Salary raise percentage
  - `minWage` - Custom minimum wage
  - `taxLimitIncreasePercent` - Tax bracket limit increase
  - `customTaxBrackets` - Custom tax brackets

### compare_scenarios

Compare multiple budget scenarios side by side.

**Input:**
- `employees` - Array of employees
- `year` - Calculation year
- `periodCount` - Number of months
- `scenarios` - Array of scenario configurations

### get_default_params

Get default Turkish payroll parameters for a year.

**Input:**
- `year` - Year to get parameters for

## Available Prompts

### budget_simulation

Interactive prompt for simulating yearly payroll budget.

### salary_raise_analysis

Analyze the cost impact of different salary raise percentages.

### year_planning

Plan yearly payroll considering potential changes.

## Example Conversations

### Budget Simulation

```
User: I have 3 employees: Ali 35k net, Ayse 45k net, Mehmet 60k gross.
      What's my yearly budget if I give 10% raise and minimum wage becomes 30k?