const LocalStrategy = require('passport-local').Strategy
const passportOneSessionPerUser = require('passport-one-session-per-user')
const bcrypt = require('bcrypt')

function initialize(passport, getUserByUsername, getUserById) {
  const authenticateUser = async (username, password, done) => {
    const user = getUserByUsername(username)
    let msg = {}
    if (user == null) {
      msg.error = 'No user with that username'
      return done(null, false, { message: msg })
    }

    try {
      if (await bcrypt.compare(password, user.password)) {
        return done(null, user)
      } else {
        msg.error = 'Password incorrect'
        return done(null, false, { message: msg })
      }
    } catch (e) {
      return done(e)
    }
  }

  passport.use(new LocalStrategy(authenticateUser))
  passport.use(new passportOneSessionPerUser())
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser((id, done) => {
    return done(null, getUserById(id))
  })
}

module.exports = initialize