<style>
    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 20px;
        background-color: #f5f5f5;
    }

    .payslip-container {
        max-width: 800px;
        margin: 0 auto;
        background-color: white;
        border: 2px solid #333;
        padding: 0;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #ddd;
    }

    .company-info h1 {
        color: #4a90e2;
        margin: 0;
        font-size: 24px;
        font-weight: bold;
    }

    .company-info p {
        margin: 5px 0;
        font-size: 12px;
        color: #666;
    }

    .payslip-title {
        color: #4a90e2;
        font-size: 28px;
        font-weight: bold;
        margin: 0;
    }

    .employee-section {
        display: flex;
        padding: 20px;
        border-bottom: 1px solid #ddd;
    }

    .employee-info {
        flex: 1;
    }

    .employee-header {
        background-color: #4a90e2;
        color: white;
        padding: 8px;
        margin: 0 0 10px 0;
        font-weight: bold;
        font-size: 14px;
    }

    .employee-details p {
        margin: 5px 0;
        font-size: 13px;
        color: #333;
    }

    .pay-info {
        flex: 1;
        margin-left: 20px;
    }

    .pay-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
        margin-bottom: 15px;
    }

    .pay-item {
        text-align: center;
    }

    .pay-item-header {
        background-color: #7db3e8;
        color: white;
        padding: 8px 4px;
        font-size: 12px;
        font-weight: bold;
    }

    .pay-item-value {
        background-color: #e8f4fd;
        padding: 8px 4px;
        font-size: 12px;
        border: 1px solid #ddd;
    }

    .payment-method {
        margin-top: 15px;
        font-size: 13px;
    }

    .earnings-section {
        padding: 20px;
    }

    .section-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }

    .section-table th {
        background-color: #4a90e2;
        color: white;
        padding: 10px;
        text-align: left;
        font-size: 13px;
        font-weight: bold;
    }

    .section-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #ddd;
        font-size: 13px;
    }

    .section-table tr:nth-child(even) {
        background-color: #f9f9f9;
    }

    .total-row {
        background-color: #d9d9d9 !important;
        font-weight: bold;
    }

    .total-row td {
        padding: 12px 10px;
        border-top: 2px solid #333;
        border-bottom: 2px solid #333;
    }

    .net-pay-row {
        background-color: #b8b8b8 !important;
        font-weight: bold;
    }

    .net-pay-row td {
        padding: 12px 10px;
        border-top: 2px solid #333;
        border-bottom: 2px solid #333;
    }

    .footer {
        text-align: center;
        padding: 20px;
        border-top: 1px solid #ddd;
        font-size: 12px;
        color: #666;
    }

    .footer-links {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
        font-size: 10px;
        color: #999;
    }

    @media (max-width: 768px) {
        .payslip-container {
            margin: 10px;
        }

        .header {
            flex-direction: column;
            text-align: center;
        }

        .employee-section {
            flex-direction: column;
        }

        .pay-info {
            margin-left: 0;
            margin-top: 20px;
        }

        .pay-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

<body>
    <div class="payslip-container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                <h1><?= $companyName ?></h1>
                <p><?= $companyAdd ?></p>
                <p>Phone: <?= $companyPhone ?>, Email: <?= $companyEmail ?></p>
            </div>
            <h2 class="payslip-title">PAYSLIP</h2>
        </div>

        <!-- Employee Information -->
        <div class="employee-section">
            <div class="employee-info">
                <div class="employee-header">EMPLOYEE INFORMATION</div>
                <div class="employee-details">
                    <p><strong><?= $name ?></strong></p>
                    <p>123 Any Court Road</p>
                    <p>London, W1T 1JY, UK</p>
                    <p>Phone: <?= $employeeDetail['Phone'] ?></p>
                    <p>Email: <?= $employeeDetail['Email'] ?></p>
                </div>
            </div>

            <div class="pay-info">
                <div class="pay-grid">
                    <div class="pay-item">
                        <div class="pay-item-header">PAY DATE</div>
                        <div class="pay-item-value"><?= $pay_date ?></div>
                    </div>
                    <div class="pay-item">
                        <div class="pay-item-header">PREVIOUS PAY DATE</div>
                        <div class="pay-item-value"><?= $previous_pay_day ?></div>
                    </div>
                    <div class="pay-item">
                        <div class="pay-item-header">PAY TYPE</div>
                        <div class="pay-item-value"><?= $payType ?></div>
                    </div>
                </div>

                <div class="pay-grid">
                    <div class="pay-item">
                        <div class="pay-item-header">PAYROLL #</div>
                        <div class="pay-item-value">1234567</div>
                    </div>
                    <div class="pay-item">
                        <div class="pay-item-header">NI NUMBER</div>
                        <div class="pay-item-value">QQ123456C</div>
                    </div>
                    <div class="pay-item">
                        <div class="pay-item-header">TAX CODE</div>
                        <div class="pay-item-value">1250L</div>
                    </div>
                </div>

                <div class="payment-method">
                    <strong>Payment Method:</strong> Check
                </div>
            </div>
        </div>

        <!-- Earnings Section -->
        <div class="earnings-section">
            <table class="section-table">
                <thead>
                    <tr>
                        <th>EARNINGS</th>
                        <th>HOURS</th>
                        <th>RATE</th>
                        <th>CURRENT</th>
                        <th>YTD</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Standard Pay</td>
                        <td>40</td>
                        <td>12.50</td>
                        <td>500.00</td>
                        <td>500.00</td>
                    </tr>
                    <tr>
                        <td>Overtime Pay</td>
                        <td>5</td>
                        <td>18.75</td>
                        <td>93.75</td>
                        <td>93.75</td>
                    </tr>
                    <tr>
                        <td>Holiday Pay</td>
                        <td>8</td>
                        <td>12.50</td>
                        <td>100.00</td>
                        <td>100.00</td>
                    </tr>
                    <tr>
                        <td>Basic Pay</td>
                        <td>-</td>
                        <td>-</td>
                        <td>1,740.00</td>
                        <td>1,740.00</td>
                    </tr>
                    <tr>
                        <td>Commission and Bonus</td>
                        <td>-</td>
                        <td>-</td>
                        <td>600.00</td>
                        <td>600.00</td>
                    </tr>
                    <tr>
                        <td>Sick Pay</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>
                    <tr>
                        <td>Expense</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3"><strong>GROSS PAY</strong></td>
                        <td><strong>£3,033.75</strong></td>
                        <td><strong>£3,033.75</strong></td>
                    </tr>
                </tbody>
            </table>

            <!-- Deductions Section -->
            <table class="section-table">
                <thead>
                    <tr>
                        <th>DEDUCTIONS</th>
                        <th></th>
                        <th></th>
                        <th>CURRENT</th>
                        <th>YTD</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>PAYE Tax</td>
                        <td></td>
                        <td></td>
                        <td>250.00</td>
                        <td>250.00</td>
                    </tr>
                    <tr>
                        <td>SHIF Contribution</td>
                        <td></td>
                        <td></td>
                        <td>55.00</td>
                        <td>55.00</td>
                    </tr>
                    <tr>
                        <td>NSSF Contribution</td>
                        <td></td>
                        <td></td>
                        <td>30.00</td>
                        <td>30.00</td>
                    </tr>
                    <tr>
                        <td>Housing Levy</td>
                        <td></td>
                        <td></td>
                        <td>50.00</td>
                        <td>50.00</td>
                    </tr>
                    <tr>
                        <td>Pension</td>
                        <td></td>
                        <td></td>
                        <td>0.00</td>
                        <td>0.00</td>
                    </tr>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>-</td>
                        <td>-</td>
                    </tr>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>-</td>
                        <td>-</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3"><strong>TOTAL DEDUCTIONS</strong></td>
                        <td><strong>£390.00</strong></td>
                        <td><strong>£390.00</strong></td>
                    </tr>
                </tbody>
            </table>

            <!-- Net Pay -->
            <table class="section-table">
                <tbody>
                    <tr class="net-pay-row">
                        <td colspan="3"><strong>NET PAY</strong></td>
                        <td><strong>£2,643.75</strong></td>
                        <td><strong>£2,643.75</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>If you have any questions about this payslip, please contact:</p>
            <p>Name, Phone, email@address.com</p>

            <div class="footer-links">
                <span>https://www.yourhr2.com/ExcelTemplates/payslip-template.html</span>
                <span>Payslip Template © 2019 by Vertex42.com</span>
            </div>
        </div>
    </div>
</body>


</html>