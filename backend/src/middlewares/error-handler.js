export function errorHandler(err, req, res, next) {
  console.error('💥 Error:', err);

  // 1. Sequelize Validation Error
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'بيانات غير صحيحة، يرجى مراجعة الحقول المطلوبة',
      errors: errors
    });
  }

  // 2. Sequelize Unique Constraint Error
  if (err.name === 'SequelizeUniqueConstraintError') {
    // حاول استخراج الحقل المكرر
    const errors = err.errors.map(e => {
      // مثلاً إذا كان الايميل مكرر
      if (e.path === 'email') return 'هذا البريد الإلكتروني مسجل لدينا بالفعل';
      if (e.path === 'phone') return 'رقم الهاتف مسجل لدينا بالفعل';
      return `يوجد قيمة مكررة مسجلة مسبقاً (${e.value || e.path})`;
    });
    return res.status(400).json({
      success: false,
      message: 'يوجد تعارض في البيانات المسجلة',
      errors: errors
    });
  }

  // 3. JWT Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'الجلسة غير صالحة، يرجى تسجيل الدخول مجدداً'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً'
    });
  }

  // 4. Custom Error with specific status code
  const statusCode = err.statusCode || err.status || 500;
  
  // 5. General message for 500 (Hide internal errors)
  let message = err.message || 'حدث خطأ داخلي في الخادم';
  if (statusCode === 500) {
    message = 'عذراً، حدث خطأ غير متوقع في النظام. فريقنا يعمل على حله الآن. ' + 
              (err.parent?.message || err.message || '') + ' ' + (err.sql || '');
  }

  res.status(statusCode).json({
    success: false,
    message: message
  });
}
