var async = require('async')
var test = require('tape')

var setup = require('./setup.js')
var Queue = require('../')

setup(function(db) {

    test('visibility: check message is back in queue after 3s', function(t) {
        var queue = new Queue(db, 'visibility', { visibility : 3 })

        async.series(
            [
                function(next) {
                    queue.add('Hello, World!', function(err) {
                        t.ok(!err, 'There is no error when adding a message.')
                        next()
                    })
                },
                function(next) {
                    queue.get(function(err, msg) {
                        // wait over 3s so the msg returns to the queue
                        t.ok(msg.id, 'Got a msg.id (sanity check)')
                        setTimeout(next, 4 * 1000)
                    })
                },
                function(next) {
                    queue.get(function(err, msg) {
                        // yes, there should be a message on the queue again
                        t.ok(msg.id, 'Got a msg.id (sanity check)')
                        queue.ack(msg.id, msg.ack, function(err) {
                            t.ok(!err, 'No error when acking the message')
                            next()
                        })
                    })
                },
                function(next) {
                    queue.get(function(err, msg) {
                        // no more messages
                        t.ok(!err, 'No error when getting no messages')
                        t.ok(!msg, 'No msg received')
                        next()
                    })
                },
            ],
            function(err) {
                if (err) t.fail(err)
                t.pass('Finished test ok')
                t.end()
            }
        )
    })

    test("visibility: check that a late ack doesn't remove the msg", function(t) {
        var queue = new Queue(db, 'visibility', { visibility : 3 })

        var originalAck

        async.series(
            [
                function(next) {
                    queue.add('Hello, World!', function(err) {
                        t.ok(!err, 'There is no error when adding a message.')
                        next()
                    })
                },
                function(next) {
                    queue.get(function(err, msg) {
                        t.ok(msg.id, 'Got a msg.id (sanity check)')

                        // remember this original ack
                        originalAck = msg.ack

                        // wait over 3s so the msg returns to the queue
                        setTimeout(function() {
                            t.pass('Back from timeout, now acking the message')

                            // now ack the message but too late - it shouldn't be deleted
                            queue.ack(msg.id, msg.ack, function(err, msg) {
                                t.ok(err, 'Got an error when acking the message late')
                                t.ok(!msg, 'No message was updated')
                                next()
                            })
                        }, 4 * 1000)
                    })
                },
                function(next) {
                    queue.get(function(err, msg) {
                        // the message should now be able to be retrieved, with a new 'ack' id
                        t.ok(msg.id, 'Got a msg.id (sanity check)')
                        t.notEqual(msg.ack, originalAck, 'Original ack and new ack are different')

                        // now ack this new retrieval
                        queue.ack(msg.id, msg.ack, next)
                    })
                },
                function(next) {
                    queue.get(function(err, msg) {
                        // no more messages
                        t.ok(!err, 'No error when getting no messages')
                        t.ok(!msg, 'No msg received')
                        next()
                    })
                },
            ],
            function(err) {
                if (err) t.fail(err)
                t.pass('Finished test ok')
                t.end()
                db.close()
            }
        )
    })

})
