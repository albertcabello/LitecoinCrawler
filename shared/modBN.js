var BN = require('bn.js');
/************************************************
 *		Modification of BN.js		*
 ***********************************************/
BN.prototype.toBuffer = function(opts) {
	var buf, hex;
	if (opts && opts.size) {
		hex = this.toString(16, 2);
		var natlen = hex.length / 2;
		buf = Buffer.from(hex, 'hex');

		if (natlen === opts.size) {
			buf = buf;
		} else if (natlen > opts.size) {
			buf = BN.trim(buf, natlen);
		} else if (natlen < opts.size) {
			buf = BN.pad(buf, natlen, opts.size);
		}
	} else {
		hex = this.toString(16, 2);
		buf = Buffer.from(hex, 'hex');
	}

	if (typeof opts !== 'undefined' && opts.endian === 'little') {
		buf = reversebuf(buf);
	}

	return buf;
};

BN.pad = function(buf, natlen, size) {
	var rbuf = Buffer.alloc(size);
	for (var i = 0; i < buf.length; i++) {
		rbuf[rbuf.length - 1 - i] = buf[buf.length - 1 - i];
	}
	for (i = 0; i < size - natlen; i++) {
		rbuf[i] = 0;
	}
	return rbuf;
};

module.exports = {BN}
