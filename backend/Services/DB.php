<?php

namespace App\Services;

/**
 * @package DB
 * 
 * Class that interacts with the MySQL database using a fluent query builder
 * 
 * @author Peter Munene <munenenjega@gmail.com>
 */
final class DB
{
    private static $instance;
    private $pdo;
    private $table;
    private $sql;
    private $bindings = [];

    private function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public static function getInstance($pdo)
    {
        if (self::$instance === null) {
            self::$instance = new self($pdo);
        }
        return self::$instance;
    }

    /**
     * Initialize a query for a specific table
     *
     * @param string $table The name of the table
     * @return DB
     */
    public static function table(string $table)
    {
        $instance = self::$instance ?? self::getInstance(null);
        $instance->table = $table;
        $instance->sql = '';
        $instance->bindings = [];
        return $instance;
    }

    public static function transaction(callable $queries)
    {
        $instance = self::$instance ?? self::getInstance(null);
        if ($instance->pdo === null) {
            throw new \Exception("No PDO connection available for transaction");
        }

        try {
            $instance->pdo->beginTransaction();
            $result = $queries();
            $instance->pdo->commit();
            return $result;
        } catch (\Exception $e) {
            $instance->pdo->rollBack();
            throw new \Exception("Transaction failed: " . $e->getMessage());
        }
    }

    /**
     * Run a raw SQL query
     *
     * @param string $sql The SQL query
     * @param array $bindings Optional query bindings
     * @return array|bool Results for SELECT or true for UPDATE/DELETE
     * @throws \Exception If query fails
     */
    public function internal_raw(string $sql, array $bindings = [])
    {
        try {
            $statement = $this->pdo->prepare($sql);
            $statement->execute($bindings);
            $results = $statement->fetchAll(\PDO::FETCH_OBJ);

            if ($this->isUpdateOrDeleteQuery($sql) && empty($results)) {
                return true;
            }
            return $results;
        } catch (\Exception $e) {
            throw new \Exception("Raw query error: " . $e->getMessage());
        }
    }

    public static function raw(string $sql)
    {
        $instance = self::$instance ?? self::getInstance(null);
        return $instance->internal_raw($sql);
    }

    private function runQuery()
    {
        try {
            $statement = $this->pdo->prepare($this->sql);
            $statement->execute($this->bindings);

            // dd($this->getDebugFullQuery($this->sql, $this->bindings));

            $results = $statement->fetchAll(\PDO::FETCH_OBJ);

            if ($this->isUpdateOrDeleteQuery($this->sql) && empty($results)) {
                return true;
            }
            return $results;
        } catch (\Exception $e) {
            //add query debug info
            throw new \Exception("Query error: " . $e->getMessage()
                . " :QUERY:" . $this->getDebugFullQuery($this->sql, $this->bindings));
        }
    }

    public function get(array $cols = [])
    {
        if (!$this->sql || empty($this->table)) {
            throw new \Exception("No table specified for query");
        }
        $results = $this->runQuery();
        //use php to filter the results
        if ($results === true || empty($cols) || $cols[0] === '*') {
            return $results;
        } else {
            return array_map(fn($item) => array_intersect_key((array)$item, array_flip($cols)), $results);
        }
    }

    /**
     * Select all records from the table
     *
     * @return array
     */
    public function selectAll()
    {
        $this->sql = "SELECT * FROM {$this->table} ORDER BY `created_at` DESC";
        return $this->runQuery();
    }

    /**
     * Select specific columns
     *
     * @param array $values Columns to select
     * @return array
     */
    public function select(array $values)
    {
        $columns = implode(',', $values);
        $this->sql = "SELECT {$columns} FROM {$this->table}";
        return $this->runQuery();
    }

    /**
     * Select records where ID matches
     *
     * @param mixed $value ID value
     * @return array
     */
    public function selectAllWhereID($value)
    {
        $this->sql = "SELECT * FROM {$this->table} WHERE `id` = :id ORDER BY `created_at` DESC";
        $this->bindings = ['id' => $value];
        return $this->runQuery();
    }

    /**
     * Select records with a where condition
     *
     * @param string $column Column name
     * @param mixed $value Value to match
     * @param string $condition Operator (default: =)
     * @return array
     */
    public function selectAllWhere(string $column, $value, string $condition = '=')
    {
        $this->sql = "SELECT * FROM {$this->table} WHERE `{$column}` {$condition} :value ORDER BY `created_at` DESC";
        $this->bindings = ['value' => $value];
        return $this->runQuery();
    }

    /**
     * Select all records with multiple where conditions
     *
     * @param string $column Column name
     * @param mixed $value Value to match
     * @param string $condition Operator (default: =)
     * @return this
     */
    // Add to your DB class
    public function orderBy(string $column, string $direction = 'ASC'): DB
    {
        $this->sql .= " ORDER BY `{$column}` {$direction}";
        return $this;
    }

    public function limit(int $limit): DB
    {
        $this->sql .= " LIMIT {$limit}";
        return $this;
    }

    public function offset(int $offset): DB
    {
        $this->sql .= " OFFSET {$offset}";
        return $this;
    }

    public function where(array $conditions, string $operator = '='): DB
    {
        // Initialize SQL if not already set
        if (empty($this->sql)) {
            $this->sql = "SELECT * FROM {$this->table}";
            $this->bindings = [];
        }

        // Check if we need to add WHERE or AND
        if (strpos($this->sql, 'WHERE') === false) {
            $this->sql .= " WHERE ";
        } else {
            $this->sql .= " AND ";
        }

        $whereParts = [];
        foreach ($conditions as $column => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            $param = str_replace('.', '_', $column) . '_' . count($this->bindings);

            if ($operator === 'LIKE') {
                $whereParts[] = "`{$column}` LIKE :{$param}";
                $this->bindings[$param] = "%{$value}%";
            } else {
                $whereParts[] = "`{$column}` {$operator} :{$param}";
                $this->bindings[$param] = $value;
            }
        }

        $this->sql .= implode(' AND ', $whereParts);
        return $this;
    }

    /**
     * Select specific columns with multiple where conditions
     *
     * @param array $values Columns to select
     * @param array $conditions Array of [column, value] pairs
     * @return array
     */
    public function selectWhere(array $values, array $condition)
    {
        $columns = implode(',', $values);
        list($column, $value) = $condition;
        $this->sql = "SELECT {$columns} FROM {$this->table} WHERE `{$column}` = :value";
        $this->bindings = ['value' => $value];
        return $this->runQuery();
    }

    /**
     * Update records
     *
     * @param array $dataToUpdate Key-value pairs to update
     * @param string $where Column for WHERE clause
     * @param mixed $isValue Value for WHERE clause
     * @return bool
     */
    public function update(array $dataToUpdate, string $where, $isValue)
    {
        $setParts = [];
        $bindings = [];
        foreach ($dataToUpdate as $key => $value) {
            $setParts[] = "`{$key}` = :{$key}";
            $bindings[$key] = $value;
        }
        $setClause = implode(', ', $setParts);
        $bindings['whereValue'] = $isValue;
        $this->sql = "UPDATE {$this->table} SET {$setClause} WHERE `{$where}` = :whereValue";
        $this->bindings = $bindings;
        return $this->runQuery();
    }

    /**
     * Delete records
     *
     * @param string $where Column for WHERE clause
     * @param mixed $isValue Value for WHERE clause
     * @return bool
     */
    public function delete(string $where, $isValue)
    {
        $this->sql = "DELETE FROM {$this->table} WHERE `{$where}` = :value";
        $this->bindings = ['value' => $isValue];
        return $this->runQuery();
    }

    /**
     * Insert a new record
     *
     * @param array $parameters Key-value pairs to insert
     * @return void
     */
    public function insert(array $parameters)
    {
        $columns = implode(', ', array_keys($parameters));
        $placeholders = ':' . implode(', :', array_keys($parameters));
        $this->sql = "INSERT INTO {$this->table} ({$columns}) VALUES ({$placeholders})";
        $this->bindings = $parameters;
        try {
            $statement = $this->pdo->prepare($this->sql);
            $statement->execute($this->bindings);
        } catch (\Exception $e) {
            throw new \Exception("Insert error: " . $e->getMessage()
                . " :QUERY:" . $this->getDebugFullQuery($this->sql, $this->bindings));
        }
    }

    /**
     * Join two tables
     *
     * @param string $table2 Second table
     * @param string $fk Foreign key
     * @param string $pk Primary key
     * @return array
     */
    public function join(string $table2, string $fk, string $pk)
    {
        $this->sql = "SELECT * FROM `{$this->table}` INNER JOIN `{$table2}` ON {$this->table}.{$fk} = {$table2}.{$pk}";
        return $this->runQuery();
    }

    /**
     * Count records with a condition
     *
     * @param array $condition [column, value]
     * @return array
     */
    public function countWhere(array $condition)
    {
        if (count($condition) !== 1) {
            throw new \Exception("Condition must have exactly one key-value pair");
        }
        $column = key($condition);
        $value = current($condition);

        $this->sql = "SELECT COUNT(*) AS count FROM {$this->table} WHERE `{$column}` = :value";
        $this->bindings = ['value' => $value];
        return $this->runQuery();
    }
    public function count()
    {
        // Store original SQL and bindings
        $originalSql = $this->sql;
        $originalBindings = $this->bindings;

        // If we have a WHERE clause, modify it for COUNT
        if (strpos($originalSql, 'WHERE') !== false) {
            $countSql = "SELECT COUNT(*) AS count " . substr($originalSql, strpos($originalSql, 'FROM'));
        } else {
            $countSql = "SELECT COUNT(*) AS count FROM {$this->table}";
        }

        try {
            $statement = $this->pdo->prepare($countSql);
            $statement->execute($originalBindings);
            return $statement->fetchAll(\PDO::FETCH_OBJ);
        } catch (\Exception $e) {
            throw new \Exception("Count error: " . $e->getMessage());
        }
    }

    /**
     * Check if query is UPDATE or DELETE
     *
     * @param string $sql SQL query
     * @return bool
     */
    private function isUpdateOrDeleteQuery(string $sql): bool
    {
        return stripos($sql, 'update') !== false || stripos($sql, 'delete') !== false;
    }

    static public function getDebugFullQuery($query, $params = [])
    {
        if (is_array($params) && count($params)) {

            $search = [];
            $replace = [];

            foreach ($params as $k => $p) {
                $pos = strpos($query, ":{$k}");
                if ($pos !== false) {
                    $query = substr($query, 0, $pos) . "%!-!{$k}!-!%" . substr($query, $pos + strlen($k) + 1);
                } else {
                    $pos = strpos($query, "?");
                    if ($pos !== false) {
                        $query = substr($query, 0, $pos) . "%!-!{$k}!-!%" . substr($query, $pos + 1);
                    } else {
                        break;
                    }
                }

                $search[] = "%!-!{$k}!-!%";

                // Wrap value in single quotes (NO escaping)
                // Optionally keep \n/\r escaped if for debug readability
                $safeParam = str_replace(["\r", "\n"], ["\\r", "\\n"], $p);
                $replace[] = "'" . $safeParam . "'";
            }

            if (count($search)) {
                $query = str_replace($search, $replace, $query);
            }
        }

        return $query; // Do NOT apply stripslashes or addslashes
    }
}
